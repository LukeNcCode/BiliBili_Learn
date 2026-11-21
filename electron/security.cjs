const path = require("path");
const { fileURLToPath, pathToFileURL } = require("url");

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "";
const APP_ENTRY_PATH = path.resolve(__dirname, "..", "dist", "index.html");
const APP_ENTRY_URL = pathToFileURL(APP_ENTRY_PATH).href;
const DEV_ENTRY_ORIGIN = DEV_SERVER_URL
  ? new URL(DEV_SERVER_URL).origin
  : "";

function normalizePathname(pathname) {
  return decodeURIComponent(pathname).replace(/\\/g, "/").toLowerCase();
}

function isTrustedAppUrl(candidate) {
  let parsed;
  try {
    parsed = new URL(String(candidate || ""));
  } catch {
    return false;
  }

  if (DEV_ENTRY_ORIGIN) {
    return (
      parsed.origin === DEV_ENTRY_ORIGIN &&
      (parsed.pathname === "/" || parsed.pathname === "/index.html")
    );
  }

  if (parsed.protocol !== "file:") return false;
  try {
    return normalizePathname(fileURLToPath(parsed)) === normalizePathname(APP_ENTRY_PATH);
  } catch {
    return false;
  }
}

function assertTrustedIpcSender(event) {
  const senderFrame = event?.senderFrame;
  if (
    !senderFrame ||
    senderFrame !== event.sender?.mainFrame ||
    !isTrustedAppUrl(senderFrame.url)
  ) {
    throw new Error("Blocked IPC call from an untrusted frame");
  }
}

function isBilibiliHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return (
    host === "bilibili.com" ||
    host.endsWith(".bilibili.com") ||
    host === "b23.tv" ||
    host.endsWith(".b23.tv")
  );
}

function isGitHubHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return (
    host === "github.com" ||
    host.endsWith(".github.com") ||
    host === "githubusercontent.com" ||
    host.endsWith(".githubusercontent.com")
  );
}

function isAllowedContentUrl(candidate) {
  let parsed;
  try {
    parsed = new URL(String(candidate || ""));
  } catch {
    return false;
  }
  if (!["https:", "http:"].includes(parsed.protocol)) return false;
  if (parsed.username || parsed.password) return false;
  return isBilibiliHost(parsed.hostname) || isGitHubHost(parsed.hostname);
}

function isSafeWebUrl(candidate) {
  try {
    const parsed = new URL(String(candidate || ""));
    return (
      ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

module.exports = {
  APP_ENTRY_PATH,
  APP_ENTRY_URL,
  DEV_SERVER_URL,
  assertTrustedIpcSender,
  isAllowedContentUrl,
  isSafeWebUrl,
  isTrustedAppUrl,
};
