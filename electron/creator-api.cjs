const { app, dialog, ipcMain, safeStorage, session } = require("electron");
const fs = require("fs");
const path = require("path");
const { assertTrustedIpcSender } = require("./security.cjs");

const BILI_PARTITION = "persist:studyflow-bilibili";
const BILI_ORIGIN = "https://www.bilibili.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_PUBLISH_BYTES = 5 * 1024 * 1024;

function biliSession() {
  const isolatedSession = session.fromPartition(BILI_PARTITION);
  isolatedSession.setUserAgent(USER_AGENT);
  return isolatedSession;
}

function cleanText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCover(value) {
  if (!value) return "";
  const cover = String(value);
  if (cover.startsWith("//")) return `https:${cover}`;
  return cover.replace(/^http:\/\//i, "https://");
}

function durationToSeconds(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parts = String(value).split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

async function biliJson(url) {
  const response = await biliSession().fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: `${BILI_ORIGIN}/`,
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Bilibili request failed: ${response.status}`);
  const payload = await response.json();
  if (payload.code !== 0) {
    throw new Error(payload.message || `Bilibili error ${payload.code}`);
  }
  return payload.data;
}

async function searchVideos(keyword) {
  const value = String(keyword || "").trim();
  if (!value) return [];
  const data = await biliJson(
    "https://api.bilibili.com/x/web-interface/search/type" +
      `?search_type=video&keyword=${encodeURIComponent(value)}&page=1`,
  );
  return (data.result || []).slice(0, 24).map((item, index) => ({
    id: `${item.bvid}-${index}`,
    bvid: item.bvid,
    title: cleanText(item.title),
    author: cleanText(item.author),
    duration: durationToSeconds(item.duration),
    cover: normalizeCover(item.pic),
    views: Number(item.play || 0),
    description: cleanText(item.description),
  }));
}

async function getVideoParts(bvid) {
  if (!/^BV[a-zA-Z0-9]{8,}$/i.test(String(bvid || ""))) {
    throw new Error("Invalid BV id");
  }
  const data = await biliJson(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
  );
  return {
    bvid: data.bvid,
    title: cleanText(data.title),
    author: cleanText(data.owner?.name || ""),
    cover: normalizeCover(data.pic),
    pages: (data.pages || []).map((page) => ({
      cid: Number(page.cid),
      page: Number(page.page),
      title: cleanText(page.part || `P${page.page}`),
      duration: Number(page.duration || 0),
    })),
  };
}

function tokenPath() {
  return path.join(app.getPath("userData"), "github-token.bin");
}

function readToken() {
  try {
    const encrypted = fs.readFileSync(tokenPath());
    return safeStorage.decryptString(encrypted);
  } catch {
    return "";
  }
}

function saveToken(token) {
  const value = String(token || "").trim();
  if (value.length < 20 || value.length > 500) {
    throw new Error("GitHub token length is invalid");
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure token storage is unavailable on this system");
  }
  fs.mkdirSync(path.dirname(tokenPath()), { recursive: true });
  fs.writeFileSync(tokenPath(), safeStorage.encryptString(value), {
    mode: 0o600,
  });
}

async function githubRequest(endpoint, token, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "BiliBili-Learning-List-Studio",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
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

async function getUser(token) {
  const response = await githubRequest("/user", token);
  return response.json();
}

async function publishProject(payload) {
  const token = readToken();
  if (!token) throw new Error("Configure a GitHub token first");
  const user = await getUser(token);
  let owner = user.login;
  let repoName = String(payload.repository || "").trim();
  let defaultBranch = payload.branch || "main";
  let created = false;

  if (!repoName) throw new Error("Repository name is required");
  if (repoName.includes("/")) {
    const parts = repoName.split("/");
    if (parts.length !== 2) throw new Error("Repository must use owner/name");
    [owner, repoName] = parts;
  }
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner)) {
    throw new Error("Invalid repository owner");
  }
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(repoName)) {
    throw new Error("Invalid repository name");
  }
  defaultBranch = String(defaultBranch || "main").trim();
  if (
    !defaultBranch ||
    defaultBranch.length > 200 ||
    !/^[A-Za-z0-9._/-]+$/.test(defaultBranch) ||
    defaultBranch.includes("..") ||
    defaultBranch.includes("//") ||
    defaultBranch.startsWith("/") ||
    defaultBranch.endsWith("/")
  ) {
    throw new Error("Invalid branch name");
  }

  if (payload.createRepository) {
    if (owner !== user.login) {
      throw new Error("New repositories are currently created under your own account");
    }
    const response = await githubRequest("/user/repos", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: repoName,
        description:
          payload.project.description ||
          `Learning list: ${payload.project.name}`,
        private: Boolean(payload.private),
        auto_init: true,
      }),
    });
    const repository = await response.json();
    defaultBranch = repository.default_branch || defaultBranch;
    created = true;
  } else {
    const response = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`,
      token,
    );
    const repository = await response.json();
    defaultBranch = payload.branch || repository.default_branch || "main";
  }

  const manifestPath = String(
    payload.manifestPath || "learning-list.json",
  ).trim();
  const pathParts = manifestPath.split("/");
  if (
    manifestPath.length > 300 ||
    manifestPath.includes("\\") ||
    pathParts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        /[\u0000-\u001f]/.test(part),
    ) ||
    !manifestPath.toLowerCase().endsWith(".json")
  ) {
    throw new Error("Invalid manifest path");
  }
  const contentEndpoint =
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/contents/` +
    manifestPath
      .split("/")
      .map(encodeURIComponent)
      .join("/");

  let sha = null;
  try {
    const existingResponse = await githubRequest(
      `${contentEndpoint}?ref=${encodeURIComponent(defaultBranch)}`,
      token,
    );
    const existing = await existingResponse.json();
    sha = existing.sha || null;
  } catch (error) {
    if (!String(error.message).includes("404")) throw error;
  }

  const manifest = {
    version: 1,
    name: payload.project.name,
    description: payload.project.description,
    goal: payload.project.goal,
    courses: payload.project.courses,
  };
  const serializedManifest = JSON.stringify(manifest, null, 2);
  if (Buffer.byteLength(serializedManifest, "utf8") > MAX_PUBLISH_BYTES) {
    throw new Error("Learning list is larger than 5 MB");
  }
  const response = await githubRequest(contentEndpoint, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `${sha ? "Update" : "Add"} learning list: ${manifest.name}`,
      content: Buffer.from(serializedManifest, "utf8").toString("base64"),
      branch: defaultBranch,
      ...(sha ? { sha } : {}),
    }),
  });
  const result = await response.json();
  return {
    created,
    owner,
    repository: repoName,
    branch: defaultBranch,
    repositoryUrl: `https://github.com/${owner}/${repoName}`,
    manifestUrl: result.content?.html_url || "",
    commitUrl: result.commit?.html_url || "",
  };
}

ipcMain.handle("studio:save-token", async (_event, token) => {
  assertTrustedIpcSender(_event);
  const value = String(token || "").trim();
  if (!value) throw new Error("Token is empty");
  const user = await getUser(value);
  saveToken(value);
  return { login: user.login, avatarUrl: user.avatar_url };
});

ipcMain.handle("studio:clear-token", (event) => {
  assertTrustedIpcSender(event);
  if (fs.existsSync(tokenPath())) fs.unlinkSync(tokenPath());
  return true;
});

ipcMain.handle("studio:get-auth-state", async (event) => {
  assertTrustedIpcSender(event);
  const token = readToken();
  if (!token) return { authenticated: false };
  try {
    const user = await getUser(token);
    return {
      authenticated: true,
      login: user.login,
      avatarUrl: user.avatar_url,
    };
  } catch {
    return { authenticated: false };
  }
});

ipcMain.handle("studio:publish", async (event, payload) => {
  assertTrustedIpcSender(event);
  if (!payload || typeof payload !== "object" || !payload.project) {
    throw new Error("Invalid publish request");
  }
  const result = await dialog.showMessageBox({
    type: "warning",
    title: "Publish learning list",
    message: `Publish to ${String(payload.repository || "")}?`,
    detail: `Branch: ${String(payload.branch || "main")}\nPath: ${String(
      payload.manifestPath || "learning-list.json",
    )}`,
    buttons: ["Publish", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (result.response !== 0) throw new Error("Publish cancelled");
  return publishProject(payload);
});
ipcMain.handle("studio:search-videos", (event, keyword) => {
  assertTrustedIpcSender(event);
  return searchVideos(keyword);
});
ipcMain.handle("studio:get-video-parts", (event, bvid) => {
  assertTrustedIpcSender(event);
  return getVideoParts(bvid);
});
