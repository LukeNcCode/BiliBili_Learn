const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  powerSaveBlocker,
  session,
  shell,
} = require("electron");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const {
  APP_ENTRY_PATH,
  DEV_SERVER_URL,
  assertTrustedIpcSender,
  isAllowedContentUrl,
  isSafeWebUrl,
  isTrustedAppUrl,
} = require("./security.cjs");
const { createPersistentStorage } = require("./storage.cjs");
const { createUpdaterService } = require("./updater.cjs");
// Registers the creator and GitHub IPC services shared by the in-app creator mode.
require("./creator-api.cjs");

const BILI_PARTITION = "persist:studyflow-bilibili";
const BILI_ORIGIN = "https://www.bilibili.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

app.setPath(
  "userData",
  path.join(app.getPath("appData"), "BiliBili Learning Version"),
);
app.setAppUserModelId("app.bilibili.learning.version");
const persistentStorage = createPersistentStorage(app.getPath("userData"));

let mainWindow = null;
let loginWindow = null;
let playbackPowerBlocker = null;
let miniPlayerActive = false;
let normalWindowBounds = null;
let miniPlayerTransitionBusy = false;
let queuedMiniPlayerTarget = null;
let recommendationCache = { timestamp: 0, items: [] };
let recommendationRefreshSerial = 0;
let recommendationInFlight = null;
let configuredScreenshotDirectory = "";
const searchCache = new Map();
const collectionCache = new Map();
const commentCache = new Map();
const replyCache = new Map();
const commentAidCache = new Map();
const trustedMediaHosts = new Set();

function setBoundedCache(map, key, value, maxEntries) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > maxEntries) {
    map.delete(map.keys().next().value);
  }
}

function defaultScreenshotDirectory() {
  return path.join(app.getPath("pictures"), "BiliBili Learning Version");
}

function screenshotSettingsPath() {
  return path.join(app.getPath("userData"), "screenshot-settings.json");
}

function loadScreenshotDirectory() {
  try {
    const payload = JSON.parse(fs.readFileSync(screenshotSettingsPath(), "utf8"));
    const directory = String(payload?.directory || "").trim();
    return directory && path.isAbsolute(directory)
      ? path.resolve(directory)
      : defaultScreenshotDirectory();
  } catch {
    return defaultScreenshotDirectory();
  }
}

function storeScreenshotDirectory(directory) {
  const resolved = path.resolve(String(directory || ""));
  if (!path.isAbsolute(resolved)) {
    throw new Error("Invalid screenshot directory");
  }
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(
    screenshotSettingsPath(),
    JSON.stringify({ directory: resolved }, null, 2),
    "utf8",
  );
  configuredScreenshotDirectory = resolved;
}

function safeFileName(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

async function savePlayerScreenshot(webContents, payload = {}) {
  const rect = payload.rect || {};
  const x = Math.max(0, Math.round(Number(rect.x) || 0));
  const y = Math.max(0, Math.round(Number(rect.y) || 0));
  const width = Math.round(Number(rect.width) || 0);
  const height = Math.round(Number(rect.height) || 0);
  if (width < 16 || height < 16) {
    throw new Error("Invalid screenshot area");
  }

  const image = await webContents.capturePage({ x, y, width, height });
  if (image.isEmpty()) throw new Error("Unable to capture the player");

  const rootDirectory =
    configuredScreenshotDirectory || defaultScreenshotDirectory();
  const folderName = safeFileName(payload.folderName, "BiliBili Learning");
  const fileBase = safeFileName(payload.fileBase, "Video");
  const targetDirectory = path.join(rootDirectory, folderName);
  fs.mkdirSync(targetDirectory, { recursive: true });

  let filePath = path.join(targetDirectory, `${fileBase}.png`);
  let suffix = 2;
  while (fs.existsSync(filePath)) {
    filePath = path.join(targetDirectory, `${fileBase}-${suffix}.png`);
    suffix += 1;
  }
  fs.writeFileSync(filePath, image.toPNG());
  return { path: filePath };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 680,
    title: "BiliBili Learning Version",
    frame: false,
    backgroundColor: "#111216",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      partition: BILI_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-frame-navigate", (details) => {
    if (!details.isMainFrame) return;
    if (!isTrustedAppUrl(details.url)) details.preventDefault();
  });
  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(APP_ENTRY_PATH);
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.on("console-message", (details) => {
    if (process.env.STUDYFLOW_DEBUG) {
      console.log(`[renderer:${details.level}] ${details.message}`);
    }
  });
  if (process.env.STUDYFLOW_CAPTURE) {
    mainWindow.webContents.once("did-finish-load", async () => {
      const captureDelay = Math.max(
        1000,
        Number(process.env.STUDYFLOW_CAPTURE_DELAY || 3500),
      );
      await new Promise((resolve) => setTimeout(resolve, captureDelay));
      if (
        process.env.STUDYFLOW_CAPTURE_VIEW === "video" ||
        process.env.STUDYFLOW_CAPTURE_VIEW === "video-mini" ||
        process.env.STUDYFLOW_CAPTURE_VIEW === "video-danmaku" ||
        process.env.STUDYFLOW_CAPTURE_VIEW === "video-comments"
      ) {
        await mainWindow.webContents.executeJavaScript(
          "document.querySelector('.video-cover')?.click()",
        );
        await new Promise((resolve) => setTimeout(resolve, 6500));
        if (process.env.STUDYFLOW_CAPTURE_VIEW === "video-mini") {
          await mainWindow.webContents.executeJavaScript(`
            document.querySelector('button[title*="迷你播放器"]')?.click()
          `);
          await new Promise((resolve) => setTimeout(resolve, 1800));
        } else if (
          process.env.STUDYFLOW_CAPTURE_VIEW === "video-danmaku"
        ) {
          await mainWindow.webContents.executeJavaScript(`
            document.querySelector('.player-center-play')?.click();
            const video = document.querySelector('.study-player video');
            if (video) {
              video.currentTime = 8;
              video.play().catch(() => undefined);
            }
          `);
          await new Promise((resolve) => setTimeout(resolve, 4500));
        } else if (
          process.env.STUDYFLOW_CAPTURE_VIEW === "video-comments"
        ) {
          await mainWindow.webContents.executeJavaScript(`
            document.querySelector('.video-comments')
              ?.scrollIntoView({ block: 'start' });
          `);
          await new Promise((resolve) => setTimeout(resolve, 4500));
        }
      } else if (process.env.STUDYFLOW_CAPTURE_VIEW === "search") {
        await mainWindow.webContents.executeJavaScript(`
          (() => {
            const input = document.querySelector('.global-search input');
            if (!input) return;
            const setter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              'value'
            ).set;
            setter.call(input, 'MIT 线性代数');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.closest('form')?.requestSubmit();
          })()
        `);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else if (process.env.STUDYFLOW_CAPTURE_VIEW === "lists") {
        await mainWindow.webContents.executeJavaScript(`
          [...document.querySelectorAll('.sidebar-primary button')]
            .find((button) => button.textContent?.includes('学习清单'))
            ?.click()
        `);
        await new Promise((resolve) => setTimeout(resolve, 1200));
      } else if (process.env.STUDYFLOW_CAPTURE_VIEW === "settings") {
        await mainWindow.webContents.executeJavaScript(`
          [...document.querySelectorAll('.sidebar-primary button')]
            .find((button) => button.textContent?.includes('设置'))
            ?.click()
        `);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await mainWindow.webContents.executeJavaScript(`
          document.querySelector('.update-settings-card')
            ?.scrollIntoView({ block: 'center' })
        `);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else if (process.env.STUDYFLOW_CAPTURE_VIEW === "creator") {
        await mainWindow.webContents.executeJavaScript(
          "window.studyflow?.openCreatorStudio()",
        );
        await new Promise((resolve) => setTimeout(resolve, 1800));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      const captureWindow =
        process.env.STUDYFLOW_CAPTURE_VIEW === "creator"
          ? BrowserWindow.getAllWindows().find(
              (window) => window.id !== mainWindow.id,
            )
          : mainWindow;
      const image = await (captureWindow || mainWindow).webContents.capturePage();
      fs.writeFileSync(process.env.STUDYFLOW_CAPTURE, image.toPNG());
      app.quit();
    });
  }
  mainWindow.on("closed", () => {
    miniPlayerActive = false;
    normalWindowBounds = null;
    mainWindow = null;
  });
}

configuredScreenshotDirectory = loadScreenshotDirectory();

function animateWindowOpacity(window, targetOpacity, duration) {
  return new Promise((resolve) => {
    const startOpacity = window.getOpacity();
    const startedAt = Date.now();

    const tick = () => {
      if (window.isDestroyed()) {
        resolve();
        return;
      }
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      window.setOpacity(
        startOpacity + (targetOpacity - startOpacity) * eased,
      );
      if (progress < 1) {
        setTimeout(tick, 16);
      } else {
        resolve();
      }
    };
    tick();
  });
}

async function transitionMiniPlayer(active) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (active === miniPlayerActive) {
    mainWindow.webContents.send("player:mini-changed", active);
    return;
  }

  if (active) {
    normalWindowBounds = mainWindow.getBounds();
    await animateWindowOpacity(mainWindow, 0, 90);
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setMinimumSize(420, 280);
    mainWindow.setAlwaysOnTop(true, "floating");
    const startBounds = mainWindow.getBounds();
    const targetBounds = {
      x: Math.round(startBounds.x + (startBounds.width - 520) / 2),
      y: Math.round(startBounds.y + (startBounds.height - 340) / 2),
      width: 520,
      height: 340,
    };
    mainWindow.setBounds(targetBounds);
    mainWindow.webContents.send("player:mini-changed", true);
    await new Promise((resolve) => setTimeout(resolve, 45));
    await animateWindowOpacity(mainWindow, 1, 150);
  } else {
    await animateWindowOpacity(mainWindow, 0, 90);
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(1050, 680);
    const fallbackBounds = {
      x: mainWindow.getBounds().x,
      y: mainWindow.getBounds().y,
      width: 1440,
      height: 920,
    };
    mainWindow.setBounds(normalWindowBounds || fallbackBounds);
    mainWindow.webContents.send("player:mini-changed", false);
    await new Promise((resolve) => setTimeout(resolve, 45));
    normalWindowBounds = null;
    await animateWindowOpacity(mainWindow, 1, 150);
  }
  miniPlayerActive = active;
}

async function setMiniPlayer(active) {
  queuedMiniPlayerTarget = Boolean(active);
  if (miniPlayerTransitionBusy) return;
  miniPlayerTransitionBusy = true;
  try {
    while (queuedMiniPlayerTarget !== null) {
      const target = queuedMiniPlayerTarget;
      queuedMiniPlayerTarget = null;
      await transitionMiniPlayer(target);
    }
  } finally {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1);
    }
    miniPlayerTransitionBusy = false;
  }
}

function biliSession() {
  const isolatedSession = session.fromPartition(BILI_PARTITION);
  isolatedSession.setUserAgent(USER_AGENT);
  return isolatedSession;
}

async function getBiliCookies() {
  return biliSession().cookies.get({ url: `${BILI_ORIGIN}/` });
}

async function getLoginState() {
  const cookies = await getBiliCookies();
  const sessData = cookies.find((cookie) => cookie.name === "SESSDATA");
  const userId = cookies.find((cookie) => cookie.name === "DedeUserID");
  const loggedIn = Boolean(sessData && userId);
  let userName = null;
  let avatarUrl = null;
  let followers = null;
  let following = null;
  if (loggedIn) {
    try {
      const response = await biliSession().fetch(
        "https://api.bilibili.com/x/web-interface/nav",
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            Referer: `${BILI_ORIGIN}/`,
            "User-Agent": USER_AGENT,
          },
        },
      );
      if (response.ok) {
        const payload = await response.json();
        if (payload.code === 0 && payload.data?.isLogin) {
          userName = cleanText(payload.data.uname) || null;
          avatarUrl = normalizeCover(payload.data.face) || null;
        }
      }
    } catch {}
    try {
      const response = await biliSession().fetch(
        `https://api.bilibili.com/x/relation/stat?vmid=${encodeURIComponent(
          userId?.value || "",
        )}`,
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            Referer: `${BILI_ORIGIN}/`,
            "User-Agent": USER_AGENT,
          },
        },
      );
      if (response.ok) {
        const payload = await response.json();
        if (payload.code === 0) {
          const follower = Number(payload.data?.follower);
          const followingCount = Number(payload.data?.following);
          followers = Number.isFinite(follower) ? follower : null;
          following = Number.isFinite(followingCount) ? followingCount : null;
        }
      }
    } catch {}
  }
  return {
    loggedIn,
    userId: userId?.value || null,
    userName,
    avatarUrl,
    followers,
    following,
  };
}

function cleanText(value = "", maxLength = 5000) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeCover(value) {
  if (!value) return "";
  const cover = String(value).startsWith("//")
    ? `https:${String(value)}`
    : String(value).replace(/^http:\/\//i, "https://");
  try {
    const parsed = new URL(cover);
    const host = parsed.hostname.toLowerCase();
    const allowed =
      host === "hdslb.com" ||
      host.endsWith(".hdslb.com") ||
      host === "biliimg.com" ||
      host.endsWith(".biliimg.com") ||
      host === "bilivideo.com" ||
      host.endsWith(".bilivideo.com");
    return parsed.protocol === "https:" && allowed ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function durationToSeconds(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parts = String(value)
    .split(":")
    .map((part) => Number(part));
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function normalizeFeedItem(item, index) {
  if (!item || !item.bvid || (item.goto && item.goto !== "av")) return null;
  const tags = Array.isArray(item.tag)
    ? item.tag.map(cleanText)
    : String(item.tag || "")
        .split(",")
        .map(cleanText)
        .filter(Boolean);

  return {
    id: `bili-${item.bvid}`,
    bvid: item.bvid,
    title: cleanText(item.title),
    description: cleanText(item.desc || item.description || ""),
    cover: normalizeCover(item.pic),
    author: cleanText(item.owner?.name || item.author || ""),
    authorId: String(item.owner?.mid || item.mid || ""),
    authorAvatar: normalizeCover(
      item.owner?.face || item.face || item.upic || "",
    ),
    duration: durationToSeconds(item.duration),
    publishedAt: Number(item.pubdate || item.senddate || 0) * 1000,
    views: Number(
      item.stat?.view ?? item.play ?? String(item.play || 0).replace(/\D/g, ""),
    ),
    likes: Number(item.stat?.like || item.like || 0),
    category: cleanText(item.tname || item.typename || ""),
    tags,
    position: Number(item.pos ?? index),
    recommendReason: cleanText(item.rcmd_reason?.reason || ""),
    source: "bilibili",
  };
}

async function fetchJson(url) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await biliSession().fetch(url, {
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
          Referer: `${BILI_ORIGIN}/`,
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const error = new Error(
          `Bilibili request failed: ${response.status}`,
        );
        if (
          attempt === 0 &&
          (response.status === 429 || response.status >= 500)
        ) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 450));
          continue;
        }
        throw error;
      }
      const payload = await response.json();
      if (payload.code !== 0) {
        throw new Error(payload.message || `Bilibili error ${payload.code}`);
      }
      return payload.data;
    } catch (error) {
      lastError = error;
      if (attempt === 0 && error?.name === "AbortError") {
        await new Promise((resolve) => setTimeout(resolve, 450));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("Bilibili request failed");
}

async function buildRecommendations(force = false) {
  const now = Date.now();
  if (
    !force &&
    recommendationCache.items.length > 0 &&
    now - recommendationCache.timestamp < 3 * 60 * 1000
  ) {
    return { items: recommendationCache.items, cached: true };
  }

  try {
    const collected = [];
    const seen = new Set();
    if (force) recommendationRefreshSerial += 1;
    const learningProbeQueries = [
      "医学课程",
      "法学公开课",
      "考研政治",
      "大学公开课",
      "计算机公开课",
      "人文社科公开课",
      "经济管理公开课",
      "数学公开课",
      "物理公开课",
      "英语学习",
    ];

    const collectPersonalizedBatch = async (batchSize) => {
      const requests = Array.from({ length: batchSize }, () => {
        const freshIndex =
          recommendationRefreshSerial * 17 +
          Math.floor(Math.random() * 90) +
          1;
        return fetchJson(
          "https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd" +
            `?ps=30&fresh_type=3&fresh_idx=${freshIndex}` +
            "&feed_version=V8&web_location=1430650&y_num=8",
        );
      });
      const results = await Promise.allSettled(requests);
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        const candidates = Array.isArray(result.value.item)
          ? result.value.item
          : [];
        candidates.forEach((candidate, index) => {
          const normalized = normalizeFeedItem(
            candidate,
            collected.length + index,
          );
          if (normalized && !seen.has(normalized.bvid)) {
            seen.add(normalized.bvid);
            collected.push(normalized);
          }
        });
      });
    };

    for (let batch = 0; batch < 2; batch += 1) {
      await collectPersonalizedBatch(2);
      if (batch === 0) {
        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    }

    const probeOffset =
      recommendationRefreshSerial + Math.floor(now / 60_000);
    const selectedProbes = Array.from({ length: 4 }, (_value, index) => {
      const query =
        learningProbeQueries[
          (probeOffset + index * 3) % learningProbeQueries.length
        ];
      return {
        keyword: query,
        page: (probeOffset + index) % 2 === 0 ? 1 : 2,
        order: index === 3 ? "pubdate" : "",
      };
    });

    for (const probeOptions of selectedProbes) {
      try {
        const probe = await searchVideos({
          ...probeOptions,
          bypassCache: force,
        });
        probe.items.slice(0, 16).forEach((item, index) => {
          if (seen.has(item.bvid)) return;
          seen.add(item.bvid);
          collected.push({
            ...item,
            position: collected.length + index,
            recommendReason:
              item.recommendReason || `学习主题：${probeOptions.keyword}`,
          });
        });
      } catch {
        // A failed subject probe should not block the personalized stream.
      }
      await new Promise((resolve) => setTimeout(resolve, 420));
    }

    const items = collected.slice(0, 200);
    if (items.length === 0) throw new Error("No video candidates returned");
    recommendationCache = { timestamp: now, items };
    return { items, cached: false };
  } catch (error) {
    if (recommendationCache.items.length > 0) {
      return {
        items: recommendationCache.items,
        cached: true,
        warning: String(error.message || error),
      };
    }
    throw error;
  }
}

async function getRecommendations(force = false) {
  if (recommendationInFlight) return recommendationInFlight;
  recommendationInFlight = buildRecommendations(force).finally(() => {
    recommendationInFlight = null;
  });
  return recommendationInFlight;
}

async function searchVideos({
  keyword,
  page = 1,
  order = "",
  bypassCache = false,
}) {
  const normalizedKeyword = String(keyword || "").trim().slice(0, 80);
  if (!normalizedKeyword) return { items: [] };
  const cacheKey = `${normalizedKeyword}:${page}:${order}`;
  const cached = searchCache.get(cacheKey);
  if (
    !bypassCache &&
    cached &&
    Date.now() - cached.timestamp < 5 * 60 * 1000
  ) {
    return { items: cached.items, cached: true };
  }

  const url =
    "https://api.bilibili.com/x/web-interface/search/type" +
    `?search_type=video&keyword=${encodeURIComponent(normalizedKeyword)}` +
    `&page=${page}${order ? `&order=${encodeURIComponent(order)}` : ""}`;
  const data = await fetchJson(url);
  const items = (data.result || [])
    .map((item) => normalizeFeedItem({ ...item, goto: "av" }))
    .filter(Boolean);
  setBoundedCache(
    searchCache,
    cacheKey,
    { timestamp: Date.now(), items },
    500,
  );
  return { items, cached: false };
}

async function getSubtitles(payload) {
  const { bvid, cid: requestedCid } =
    typeof payload === "string" ? { bvid: payload } : payload || {};
  if (!/^BV[a-zA-Z0-9]+$/.test(String(bvid || ""))) {
    throw new Error("Invalid BV id");
  }

  const pages = await fetchJson(
    `https://api.bilibili.com/x/player/pagelist?bvid=${encodeURIComponent(bvid)}`,
  );
  const cid = requestedCid || pages?.[0]?.cid;
  if (!cid) throw new Error("Unable to resolve video part");

  const player = await fetchJson(
    "https://api.bilibili.com/x/player/v2" +
      `?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}`,
  );
  const subtitleMetadata = player?.subtitle?.subtitles || [];

  const tracks = [];
  for (const subtitle of subtitleMetadata.slice(0, 4)) {
    if (!subtitle.subtitle_url) continue;
    const absoluteUrl = normalizeCover(subtitle.subtitle_url);
    const response = await biliSession().fetch(absoluteUrl, {
      headers: {
        Referer: `${BILI_ORIGIN}/`,
        "User-Agent": USER_AGENT,
      },
    });
    if (!response.ok) continue;
    const data = await response.json();
    tracks.push({
      language: subtitle.lan || "unknown",
      label: subtitle.lan_doc || subtitle.lan || "Subtitle",
      cues: (data.body || []).map((cue) => ({
        from: Number(cue.from),
        to: Number(cue.to),
        text: cleanText(cue.content),
      })),
    });
  }

  return {
    bvid,
    cid,
    tracks,
    hasSubtitles: tracks.length > 0,
  };
}

function decodeDanmakuXml(buffer, contentType = "") {
  let xml;
  try {
    xml = new TextDecoder("utf-8").decode(buffer);
  } catch {
    xml = "";
  }
  if (xml.includes("<d ")) return xml;

  const candidates = [];
  try {
    candidates.push(zlib.inflateRawSync(buffer));
  } catch {}
  try {
    candidates.push(zlib.inflateSync(buffer));
  } catch {}
  try {
    candidates.push(zlib.gunzipSync(buffer));
  } catch {}
  for (const candidate of candidates) {
    const decoded = new TextDecoder("utf-8").decode(candidate);
    if (decoded.includes("<d ")) return decoded;
  }
  throw new Error(`Unsupported danmaku response (${contentType})`);
}

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

async function getPlayback(payload) {
  const { bvid, cid: requestedCid } =
    typeof payload === "string" ? { bvid: payload } : payload || {};
  if (!/^BV[a-zA-Z0-9]+$/.test(String(bvid || ""))) {
    throw new Error("Invalid BV id");
  }
  const pages = await fetchJson(
    `https://api.bilibili.com/x/player/pagelist?bvid=${encodeURIComponent(bvid)}`,
  );
  const selectedPart =
    pages?.find((page) => String(page.cid) === String(requestedCid)) || pages?.[0];
  if (!selectedPart?.cid) throw new Error("Unable to resolve video part");
  const cid = selectedPart.cid;

  const play = await fetchJson(
    "https://api.bilibili.com/x/player/playurl" +
      `?bvid=${encodeURIComponent(bvid)}&cid=${cid}` +
      "&qn=120&fnval=16&fourk=1",
  );
  const dash = play?.dash;
  if (!dash || !Array.isArray(dash.video) || !Array.isArray(dash.audio)) {
    throw new Error("This video does not expose a DASH stream");
  }

  const tracksByQuality = new Map();
  dash.video.forEach((track, index) => {
    if (!track?.baseUrl) return;
    const existing = tracksByQuality.get(track.id);
    if (!existing || track.codecid === 7) {
      tracksByQuality.set(track.id, {
        id: `${track.id}-${track.codecid || index}`,
        url: track.baseUrl,
        backupUrls: [
          ...(Array.isArray(track.backupUrl) ? track.backupUrl : []),
          ...(Array.isArray(track.backup_url) ? track.backup_url : []),
        ].filter((value) => typeof value === "string" && value),
        quality: Number(track.id || 0),
        codec: String(track.codecs || ""),
        width: Number(track.width || 0),
        height: Number(track.height || 0),
        frameRate: String(track.frameRate || ""),
        bandwidth: Number(track.bandwidth || 0),
      });
    }
  });
  const videoTracks = [...tracksByQuality.values()].sort(
    (left, right) => right.quality - left.quality,
  );
  const audio = [...dash.audio]
    .filter((track) => track?.baseUrl)
    .sort((left, right) => Number(right.bandwidth) - Number(left.bandwidth))[0];
  if (!audio) throw new Error("This video does not expose an audio stream");

  const mediaUrls = [
    ...videoTracks.map((track) => track.url),
    ...videoTracks.flatMap((track) => track.backupUrls),
    audio.baseUrl,
    ...(Array.isArray(audio.backupUrl) ? audio.backupUrl : []),
    ...(Array.isArray(audio.backup_url) ? audio.backup_url : []),
  ];
  mediaUrls.forEach((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:") trustedMediaHosts.add(parsed.hostname);
    } catch {}
  });

  return {
    bvid,
    cid,
    duration: Number(selectedPart.duration || 0),
    acceptQuality: play.accept_quality || [],
    videoTracks,
    audioTrack: {
      id: String(audio.id || "audio"),
      url: audio.baseUrl,
      backupUrls: [
        ...(Array.isArray(audio.backupUrl) ? audio.backupUrl : []),
        ...(Array.isArray(audio.backup_url) ? audio.backup_url : []),
      ].filter((value) => typeof value === "string" && value),
      codec: String(audio.codecs || ""),
      bandwidth: Number(audio.bandwidth || 0),
    },
  };
}

async function getDanmaku(payload) {
  const { bvid, cid: requestedCid } =
    typeof payload === "string" ? { bvid: payload } : payload || {};
  if (!/^BV[a-zA-Z0-9]+$/.test(String(bvid || ""))) {
    throw new Error("Invalid BV id");
  }
  const pages = await fetchJson(
    `https://api.bilibili.com/x/player/pagelist?bvid=${encodeURIComponent(bvid)}`,
  );
  const cid = requestedCid || pages?.[0]?.cid;
  if (!cid) throw new Error("Unable to resolve video part");

  const response = await biliSession().fetch(
    `https://api.bilibili.com/x/v1/dm/list.so?oid=${encodeURIComponent(cid)}`,
    {
      headers: {
        Referer: `${BILI_ORIGIN}/`,
        "User-Agent": USER_AGENT,
      },
    },
  );
  if (!response.ok) throw new Error(`Danmaku request failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const xml = decodeDanmakuXml(
    buffer,
    response.headers.get("content-type") || "",
  );

  const cues = [];
  const pattern = /<d p="([^"]+)">([\s\S]*?)<\/d>/g;
  let match;
  while ((match = pattern.exec(xml)) && cues.length < 8000) {
    const params = match[1].split(",");
    const time = Number(params[0]);
    if (!Number.isFinite(time)) continue;
    const colorValue = Number(params[3] || 16777215)
      .toString(16)
      .padStart(6, "0");
    cues.push({
      id: `${cid}-${cues.length}`,
      time,
      mode: Number(params[1] || 1),
      color: `#${colorValue.slice(-6)}`,
      text: decodeXmlText(match[2] || "").slice(0, 120),
    });
  }
  return cues.sort((left, right) => left.time - right.time);
}

function normalizeComment(reply) {
  if (!reply || !reply.rpid) return null;
  const rawEmotes =
    reply.content?.emote && typeof reply.content.emote === "object"
      ? reply.content.emote
      : {};
  const emojis = Object.fromEntries(
    Object.entries(rawEmotes)
      .map(([token, emote]) => [
        token,
        normalizeCover(emote?.url || emote?.meta?.url || ""),
      ])
      .filter(([_token, url]) => Boolean(url)),
  );
  return {
    id: String(reply.rpid),
    author: cleanText(reply.member?.uname || "Unknown"),
    avatar: normalizeCover(reply.member?.avatar || ""),
    content: cleanText(reply.content?.message || "").slice(0, 4000),
    emojis,
    likeCount: Math.max(0, Number(reply.like || 0)),
    replyCount: Math.max(0, Number(reply.rcount || 0)),
    createdAt: Math.max(0, Number(reply.ctime || 0)) * 1000,
    replies: Array.isArray(reply.replies)
      ? reply.replies.map(normalizeComment).filter(Boolean)
      : [],
  };
}

async function getVideoAid(bvid) {
  const normalizedBvid = String(bvid || "").trim();
  if (!/^BV[a-zA-Z0-9]+$/.test(normalizedBvid)) {
    throw new Error("Invalid BV id");
  }
  const cached = commentAidCache.get(normalizedBvid);
  if (cached) return cached;
  const view = await fetchJson(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(
      normalizedBvid,
    )}`,
  );
  const aid = Number(view?.aid || 0);
  if (!aid) throw new Error("Unable to resolve video aid");
  setBoundedCache(commentAidCache, normalizedBvid, aid, 1000);
  return aid;
}

async function getVideoComments({ bvid, page = 1, pageSize = 20 }) {
  const aid = await getVideoAid(bvid);
  const normalizedPage = Math.max(1, Math.min(100, Number(page) || 1));
  const normalizedSize = Math.max(1, Math.min(20, Number(pageSize) || 20));
  const cacheKey = `${aid}:${normalizedPage}:${normalizedSize}`;
  const cached = commentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60 * 1000) {
    return cached.data;
  }

  const data = await fetchJson(
    "https://api.bilibili.com/x/v2/reply" +
      `?type=1&oid=${encodeURIComponent(aid)}` +
      `&pn=${normalizedPage}&ps=${normalizedSize}&sort=2`,
  );
  const seen = new Set();
  const comments = [
    ...(Array.isArray(data?.top_replies) ? data.top_replies : []),
    ...(Array.isArray(data?.replies) ? data.replies : []),
  ]
    .map(normalizeComment)
    .filter((comment) => {
      if (!comment || seen.has(comment.id)) return false;
      seen.add(comment.id);
      return true;
    });
  const total = Math.max(0, Number(data?.page?.count || 0));
  const result = {
    comments,
    page: normalizedPage,
    total,
    hasMore: normalizedPage * normalizedSize < total,
  };
  setBoundedCache(
    commentCache,
    cacheKey,
    { timestamp: Date.now(), data: result },
    500,
  );
  return result;
}

async function getCommentReplies({ bvid, root, page = 1 }) {
  const rootId = String(root || "").trim();
  if (!/^\d+$/.test(rootId)) throw new Error("Invalid comment id");
  const aid = await getVideoAid(bvid);
  const normalizedPage = Math.max(1, Math.min(100, Number(page) || 1));
  const cacheKey = `${aid}:${rootId}:${normalizedPage}`;
  const cached = replyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60 * 1000) {
    return cached.data;
  }

  const data = await fetchJson(
    "https://api.bilibili.com/x/v2/reply/reply" +
      `?type=1&oid=${encodeURIComponent(aid)}` +
      `&root=${encodeURIComponent(rootId)}` +
      `&pn=${normalizedPage}&ps=20`,
  );
  const replies = (Array.isArray(data?.replies) ? data.replies : [])
    .map(normalizeComment)
    .filter(Boolean)
    .map((reply) => ({ ...reply, replies: [] }));
  const total = Math.max(0, Number(data?.page?.count || 0));
  const result = {
    replies,
    page: normalizedPage,
    total,
    hasMore: normalizedPage * 20 < total,
  };
  setBoundedCache(
    replyCache,
    cacheKey,
    { timestamp: Date.now(), data: result },
    1000,
  );
  return result;
}

async function getVideoCollection(bvid) {
  if (!/^BV[a-zA-Z0-9]+$/.test(String(bvid || ""))) {
    throw new Error("Invalid BV id");
  }
  const cached = collectionCache.get(bvid);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.data;
  }

  const view = await fetchJson(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
  );
  let collection = null;
  if (view.ugc_season?.sections?.length) {
    let runningIndex = 0;
    const sections = view.ugc_season.sections.map((section, sectionIndex) => ({
      id: String(section.id || sectionIndex),
      title: cleanText(section.title || `Section ${sectionIndex + 1}`),
      episodes: (section.episodes || []).map((episode) => {
        runningIndex += 1;
        const page = episode.page || {};
        const rawPages =
          Array.isArray(episode.pages) && episode.pages.length > 0
            ? episode.pages
            : [page];
        const variants = rawPages
          .filter((variant) => variant?.cid)
          .map((variant, variantIndex) => ({
            id: String(variant.cid),
            cid: Number(variant.cid),
            title: cleanText(
              variant.part || `Version ${variantIndex + 1}`,
            ),
            duration: Number(variant.duration || 0),
          }));
        return {
          id: String(episode.id || episode.aid || `${bvid}-${runningIndex}`),
          bvid: cleanText(episode.bvid || view.bvid),
          cid:
            Number(variants[0]?.cid || page.cid || episode.cid || 0) || null,
          title: cleanText(
            episode.title || page.part || `Episode ${runningIndex}`,
          ),
          duration: Number(
            variants[0]?.duration || page.duration || episode.arc?.duration || 0,
          ),
          cover: normalizeCover(episode.arc?.pic || view.pic),
          index: runningIndex,
          variants,
        };
      }),
    }));
    collection = {
      id: String(view.ugc_season.id || `season-${view.aid}`),
      title: cleanText(view.ugc_season.title || view.title),
      cover: normalizeCover(view.ugc_season.cover || view.pic),
      kind: "ugc-season",
      total: sections.reduce(
        (total, section) => total + section.episodes.length,
        0,
      ),
      sections,
    };
  } else if (Array.isArray(view.pages) && view.pages.length > 1) {
    const episodes = view.pages.map((page, index) => ({
      id: String(page.cid),
      bvid: view.bvid,
      cid: Number(page.cid) || null,
      title: cleanText(page.part || `P${page.page || index + 1}`),
      duration: Number(page.duration || 0),
      cover: normalizeCover(view.pic),
      index: index + 1,
      variants: [],
    }));
    collection = {
      id: `multi-${view.aid}`,
      title: cleanText(view.title),
      cover: normalizeCover(view.pic),
      kind: "multi-part",
      total: episodes.length,
      sections: [
        {
          id: "parts",
          title: "分P",
          episodes,
        },
      ],
    };
  }

  setBoundedCache(
    collectionCache,
    bvid,
    { timestamp: Date.now(), data: collection },
    300,
  );
  return collection;
}

function parseGitHubUrl(input) {
  const url = new URL(String(input || "").trim());
  const host = url.hostname.toLowerCase();
  if (
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !["https:", "http:"].includes(url.protocol)
  ) {
    throw new Error("Invalid GitHub URL");
  }
  if (host === "raw.githubusercontent.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 4) throw new Error("Invalid raw GitHub URL");
    const [rawOwner, rawRepo, rawBranch] = parts.slice(0, 3).map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        throw new Error("Invalid GitHub URL encoding");
      }
    });
    const owner = rawOwner;
    const repo = rawRepo.replace(/\.git$/i, "");
    const branch = rawBranch;
    const path = parts
      .slice(3)
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          throw new Error("Invalid GitHub URL encoding");
        }
      })
      .join("/");
    if (
      !/^[A-Za-z0-9_.-]{1,100}$/.test(owner) ||
      !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) ||
      !branch ||
      branch.includes("..") ||
      path.includes("\\") ||
      path.split("/").some((part) => part === "..")
    ) {
      throw new Error("Invalid GitHub raw URL");
    }
    return {
      owner,
      repo,
      branch,
      path,
      sourceUrl: `https://raw.githubusercontent.com/${owner}/${repo}/`,
    };
  }
  if (host !== "github.com" && host !== "www.github.com") {
    throw new Error("Only public GitHub repository links are supported");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error("Invalid GitHub repository URL");
  const owner = decodeURIComponent(parts[0]);
  const repo = decodeURIComponent(parts[1]).replace(/\.git$/i, "");
  if (
    !/^[A-Za-z0-9_.-]{1,100}$/.test(owner) ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(repo)
  ) {
    throw new Error("Invalid GitHub repository URL");
  }
  let branch = null;
  let path = "";
  if (parts[2] === "tree" && parts[3]) {
    branch = decodeURIComponent(parts[3]);
    path = parts.slice(4).map(decodeURIComponent).join("/");
  } else if (parts[2] === "blob" && parts[3]) {
    branch = decodeURIComponent(parts[3]);
    path = parts.slice(4).map(decodeURIComponent).join("/");
  }
  if (
    path.includes("\\") ||
    path.split("/").some((part) => part === "..") ||
    (branch && (branch.includes("..") || branch.includes("\\")))
  ) {
    throw new Error("Invalid GitHub path");
  }
  return {
    owner,
    repo,
    branch,
    path,
    sourceUrl: `https://github.com/${owner}/${repo}`,
  };
}

async function fetchGitHub(url, accept = "application/vnd.github+json") {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      "User-Agent": "BiliBili-Learning-Version",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    let message = `GitHub request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload.message) message = payload.message;
    } catch {}
    throw new Error(message);
  }
  return response;
}

async function readResponseTextLimited(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) {
    throw new Error("Learning list is larger than 5 MB");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Learning list is larger than 5 MB");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function extractBvid(value) {
  const match = String(value || "").match(/BV[a-zA-Z0-9]{8,}/);
  return match ? match[0] : "";
}

function uniqueId(value, fallback, seen) {
  const raw = cleanText(value, 180);
  const base = raw || fallback;
  let candidate = base;
  let suffix = 2;
  while (seen.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  seen.add(candidate);
  return candidate;
}

function normalizeLearningList(payload, location, manifestUrl) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Learning list must be a JSON object");
  }
  const rawCourses = Array.isArray(payload.courses) ? payload.courses : [];
  const courseIds = new Set();
  const sectionIds = new Set();
  const lessonIds = new Set();
  const segmentIds = new Set();
  let totalSections = 0;
  let totalLessons = 0;
  let totalSegments = 0;
  let courseIndex = 0;
  const courses = rawCourses.slice(0, 200).map((rawCourse) => {
    courseIndex += 1;
    const rawSections = Array.isArray(rawCourse.sections)
      ? rawCourse.sections
      : Array.isArray(rawCourse.chapters)
        ? rawCourse.chapters
        : [];
    const fallbackLessons = Array.isArray(rawCourse.lessons)
      ? rawCourse.lessons
      : Array.isArray(rawCourse.videos)
        ? rawCourse.videos
        : [];
    const sectionSource = (
      rawSections.length > 0
        ? rawSections
        : [{ title: "课程内容", lessons: fallbackLessons }]
    ).slice(0, Math.max(0, 2000 - totalSections));
    totalSections += sectionSource.length;

    let lessonIndex = 0;
    const sections = sectionSource
      .map((rawSection, sectionIndex) => {
        const rawLessons = Array.isArray(rawSection.lessons)
          ? rawSection.lessons
          : Array.isArray(rawSection.videos)
            ? rawSection.videos
            : Array.isArray(rawSection.items)
              ? rawSection.items
              : [];
        const lessons = rawLessons
          .slice(0, Math.max(0, 10000 - totalLessons))
          .map((rawLesson) => {
            if (totalLessons >= 10000) return null;
            lessonIndex += 1;
            totalLessons += 1;
            const lesson =
              typeof rawLesson === "string"
                ? { title: rawLesson, url: rawLesson }
                : rawLesson || {};
            const url = String(lesson.url || lesson.link || "");
            const bvid = cleanText(lesson.bvid || lesson.bv || extractBvid(url));
            if (!/^BV[a-zA-Z0-9]{8,}$/i.test(bvid)) return null;
            const rawSegments = Array.isArray(lesson.segments)
              ? lesson.segments
              : [];
            const segments = rawSegments
              .slice(0, Math.max(0, 1000 - totalSegments))
              .map((segment, segmentIndex) => ({
                id: uniqueId(
                  segment.id ||
                    `${rawCourse.id || courseIndex}-${sectionIndex}-${lessonIndex}-${segmentIndex}`,
                  `segment-${courseIndex}-${sectionIndex}-${lessonIndex}-${segmentIndex}`,
                  segmentIds,
                ),
                start: Math.max(0, Number(segment.start || 0)),
                end: Math.max(0, Number(segment.end || 0)),
                title: cleanText(
                  segment.title || segment.name || `Segment ${segmentIndex + 1}`,
                ),
              }))
              .filter(
                (segment) =>
                  Number.isFinite(segment.start) &&
                  Number.isFinite(segment.end) &&
                  segment.end > segment.start,
              )
              .sort((left, right) => left.start - right.start);
            totalSegments += segments.length;
            const inclusion =
              lesson.inclusion === "segments" || segments.length > 0
                ? "segments"
                : "full";
            return {
              id: uniqueId(
                lesson.id ||
                  `${rawCourse.id || courseIndex}-${sectionIndex}-${lessonIndex}`,
                `lesson-${courseIndex}-${sectionIndex}-${lessonIndex}`,
                lessonIds,
              ),
              title: cleanText(
                lesson.title || lesson.name || `Lesson ${lessonIndex}`,
              ),
              bvid,
              cid: Number(lesson.cid || 0) || null,
              page: Number(lesson.page || 0) || null,
              url: url || `https://www.bilibili.com/video/${bvid}`,
              duration: Number(
                lesson.duration ||
                  durationToSeconds(lesson.durationText || lesson.length || 0),
              ),
              cover: normalizeCover(lesson.cover || rawCourse.cover || ""),
              description: cleanText(lesson.description || lesson.desc || ""),
              inclusion,
              segments,
            };
          })
          .filter(Boolean);
        return {
          id: uniqueId(
            rawSection.id,
            `section-${courseIndex}-${sectionIndex + 1}`,
            sectionIds,
          ),
          title: cleanText(
            rawSection.title || rawSection.name || `Section ${sectionIndex + 1}`,
          ),
          lessons,
        };
      })
      .filter((section) => section.lessons.length > 0);

    return {
      id: uniqueId(rawCourse.id, `course-${courseIndex}`, courseIds),
      title: cleanText(rawCourse.title || rawCourse.name || `Course ${courseIndex}`),
      description: cleanText(rawCourse.description || rawCourse.desc || ""),
      cover: normalizeCover(rawCourse.cover || rawCourse.image || ""),
      author: cleanText(rawCourse.author || rawCourse.creator || ""),
      sections,
    };
  }).filter((course) => course.sections.length > 0);

  if (courses.length === 0) {
    throw new Error("No courses with Bilibili videos were found in this repository");
  }
  return {
    id: `${location.owner}/${location.repo}:${location.path || "root"}`.toLowerCase(),
    name: cleanText(
      payload.name || payload.title || `${location.owner}/${location.repo}`,
    ),
    description: cleanText(payload.description || payload.desc || ""),
    goal: cleanText(payload.goal || payload.purpose || payload.topic || ""),
    author: cleanText(payload.author || payload.creator || ""),
    createdAt: cleanText(payload.createdAt || ""),
    courses,
    sourceUrl: location.sourceUrl,
    manifestUrl,
    repository: `${location.owner}/${location.repo}`,
    source: "github",
    importedAt: Date.now(),
  };
}

async function importGitHubLearningList(input) {
  const location = parseGitHubUrl(input);
  let branch = location.branch;
  let manifestPath = "";

  if (!branch) {
    const repoResponse = await fetchGitHub(
      `https://api.github.com/repos/${encodeURIComponent(location.owner)}/${encodeURIComponent(location.repo)}`,
    );
    const repository = await repoResponse.json();
    branch = repository.default_branch || "main";
  }

  if (location.path.toLowerCase().endsWith(".json")) {
    manifestPath = location.path;
  } else {
    const treeResponse = await fetchGitHub(
      `https://api.github.com/repos/${encodeURIComponent(location.owner)}/${encodeURIComponent(location.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );
    const tree = await treeResponse.json();
    const files = (tree.tree || [])
      .filter((entry) => entry.type === "blob")
      .map((entry) => entry.path)
      .filter((path) =>
        !location.path || path === location.path || path.startsWith(`${location.path}/`),
      );
    const preferredNames = [
      ".bilibili-learning.json",
      "learning-list.json",
      "bilibili-learning.json",
      "study-list.json",
    ];
    manifestPath =
      preferredNames
        .flatMap((name) => files.filter((file) => file.split("/").pop() === name))
        .sort(
          (left, right) =>
            left.split("/").length - right.split("/").length,
        )[0] ||
      files.find((file) => file.toLowerCase().endsWith(".learning.json")) ||
      "";
  }

  if (!manifestPath) {
    throw new Error(
      "No learning-list.json or .bilibili-learning.json manifest was found",
    );
  }

  const manifestUrl =
    `https://raw.githubusercontent.com/${encodeURIComponent(location.owner)}/` +
    `${encodeURIComponent(location.repo)}/${encodeURIComponent(branch)}/` +
    manifestPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetchGitHub(manifestUrl, "application/json");
  const text = await readResponseTextLimited(response, 5 * 1024 * 1024);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Learning list manifest is not valid JSON");
  }
  return normalizeLearningList(payload, location, manifestUrl);
}

async function openOfficialLogin() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return { opened: true };
  }

  loginWindow = new BrowserWindow({
    width: 520,
    height: 720,
    minWidth: 430,
    minHeight: 620,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    title: "Bilibili Official Login",
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      partition: BILI_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  loginWindow.setMenuBarVisibility(false);
  loginWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  let loginCheckRunning = false;
  const reportLoginChange = async () => {
    if (loginCheckRunning) return;
    loginCheckRunning = true;
    try {
      const state = await getLoginState();
      if (!state.loggedIn) return;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("bili:login-changed", state);
      }
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
      }
    } catch {
      // Login polling should not surface transient cookie-store failures.
    } finally {
      loginCheckRunning = false;
    }
  };

  loginWindow.webContents.on("did-navigate", reportLoginChange);
  loginWindow.webContents.on("did-navigate-in-page", reportLoginChange);
  const loginPoll = setInterval(reportLoginChange, 1500);
  await loginWindow.loadURL("https://passport.bilibili.com/login");

  loginWindow.on("closed", () => {
    clearInterval(loginPoll);
    loginWindow = null;
  });
  return { opened: true };
}

app.whenReady().then(() => {
  const mediaSession = biliSession();
  mediaSession.webRequest.onBeforeSendHeaders(
    {
      urls: ["*://*/*"],
    },
    (details, callback) => {
      let host = "";
      try {
        host = new URL(details.url).hostname;
      } catch {}
      if (
        details.resourceType !== "media" ||
        !trustedMediaHosts.has(host)
      ) {
        callback({ requestHeaders: details.requestHeaders });
        return;
      }
      details.requestHeaders.Referer = `${BILI_ORIGIN}/`;
      details.requestHeaders.Origin = BILI_ORIGIN;
      callback({ requestHeaders: details.requestHeaders });
    },
  );
  createMainWindow();
  createUpdaterService(() => mainWindow);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function handleTrusted(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event);
    return handler(event, ...args);
  });
}

function onTrusted(channel, handler) {
  ipcMain.on(channel, (event, ...args) => {
    try {
      assertTrustedIpcSender(event);
      handler(event, ...args);
    } catch (error) {
      console.warn(`[ipc:${channel}] ${error.message}`);
    }
  });
}

handleTrusted("storage:load", (_event, key) => persistentStorage.load(key));
handleTrusted("storage:save", (_event, key, value) =>
  persistentStorage.save(key, value),
);
handleTrusted("bili:get-recommendations", (_event, force) =>
  getRecommendations(Boolean(force)),
);
handleTrusted("bili:search-videos", (_event, payload) => searchVideos(payload));
handleTrusted("bili:get-login-state", () => getLoginState());
handleTrusted("bili:open-official-login", () => openOfficialLogin());
handleTrusted("bili:get-subtitles", (_event, payload) =>
  getSubtitles(payload),
);
handleTrusted("bili:get-playback", (_event, payload) =>
  getPlayback(payload),
);
handleTrusted("bili:get-danmaku", (_event, payload) =>
  getDanmaku(payload),
);
handleTrusted("bili:get-video-comments", (_event, payload) =>
  getVideoComments(payload),
);
handleTrusted("bili:get-comment-replies", (_event, payload) =>
  getCommentReplies(payload),
);
handleTrusted("bili:get-video-collection", (_event, bvid) =>
  getVideoCollection(bvid),
);
handleTrusted("learning:import-github", (_event, url) =>
  importGitHubLearningList(url),
);
handleTrusted(
  "screenshot:choose-directory",
  async (_event, currentDirectory) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose screenshot save location",
      defaultPath:
        String(currentDirectory || "").trim() || defaultScreenshotDirectory(),
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    storeScreenshotDirectory(result.filePaths[0]);
    return configuredScreenshotDirectory;
  },
);
handleTrusted("screenshot:get-directory", () => configuredScreenshotDirectory);
handleTrusted("screenshot:save", (event, payload) =>
  savePlayerScreenshot(event.sender, payload),
);
handleTrusted("app:open-external", (_event, url) => {
  const parsed = new URL(String(url));
  if (!isAllowedContentUrl(parsed.toString())) throw new Error("Blocked URL");
  return shell.openExternal(parsed.toString());
});
handleTrusted("app:open-note-link", async (_event, url) => {
  const parsed = new URL(String(url));
  if (!isSafeWebUrl(parsed.toString())) throw new Error("Unsupported URL");
  if (isAllowedContentUrl(parsed.toString())) {
    return shell.openExternal(parsed.toString());
  }
  const result = await dialog.showMessageBox(mainWindow, {
    type: "question",
    title: "Open external link",
    message: "This link was added in your course notes.",
    detail: parsed.toString(),
    buttons: ["Open link", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (result.response === 0) return shell.openExternal(parsed.toString());
});
handleTrusted("app:open-creator-studio", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("app:open-creator-mode");
  }
  return true;
});

onTrusted("window:minimize", () => mainWindow?.minimize());
onTrusted("window:toggle-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
onTrusted("window:close", () => mainWindow?.close());
onTrusted("player:set-mini", (_event, active) => {
  setMiniPlayer(Boolean(active));
});
onTrusted("player:set-active", (_event, active) => {
  if (active) {
    if (
      playbackPowerBlocker === null ||
      !powerSaveBlocker.isStarted(playbackPowerBlocker)
    ) {
      playbackPowerBlocker =
        powerSaveBlocker.start("prevent-app-suspension");
    }
    return;
  }
  if (
    playbackPowerBlocker !== null &&
    powerSaveBlocker.isStarted(playbackPowerBlocker)
  ) {
    powerSaveBlocker.stop(playbackPowerBlocker);
  }
  playbackPowerBlocker = null;
});

app.on("before-quit", () => {
  if (
    playbackPowerBlocker !== null &&
    powerSaveBlocker.isStarted(playbackPowerBlocker)
  ) {
    powerSaveBlocker.stop(playbackPowerBlocker);
  }
  playbackPowerBlocker = null;
});
