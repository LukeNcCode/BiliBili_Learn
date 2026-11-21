const path = require("path");
const { app, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const { assertTrustedIpcSender } = require("./security.cjs");

function readPackagedMetadata() {
  try {
    return require(path.join(app.getAppPath(), "package.json"));
  } catch {
    return {};
  }
}

function normalizeRepository(value) {
  if (!value) return "";
  const raw =
    typeof value === "string"
      ? value
      : typeof value.url === "string"
        ? value.url
        : "";
  const match = raw.match(
    /github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/#?]|$)/i,
  );
  return match ? `${match[1]}/${match[2]}` : "";
}

function resolveUpdateRepository() {
  const metadata = readPackagedMetadata();
  return normalizeRepository(
    process.env.BILIBILI_LEARNING_UPDATE_REPOSITORY ||
      process.env.GITHUB_REPOSITORY ||
      metadata.updateRepository ||
      metadata.repository,
  );
}

function createUpdaterService(getMainWindow) {
  const repository = resolveUpdateRepository();
  const releasesUrl = repository
    ? `https://github.com/${repository}/releases`
    : "";
  let state = {
    status: repository
      ? app.isPackaged
        ? "idle"
        : "disabled"
      : "not-configured",
    currentVersion: app.getVersion(),
    latestVersion: null,
    percent: 0,
    message: "",
    repository,
    releasesUrl,
    checkedAt: null,
  };
  let checkPromise = null;
  let downloadPromise = null;

  function notify() {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updates:changed", state);
    }
  }

  function update(next) {
    state = { ...state, ...next };
    notify();
    return state;
  }

  function configureFeed() {
    if (!repository || !app.isPackaged) return false;
    const [owner, repo] = repository.split("/");
    autoUpdater.setFeedURL({
      provider: "github",
      owner,
      repo,
      private: false,
      releaseType: "release",
    });
    return true;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;

  autoUpdater.on("checking-for-update", () => {
    update({ status: "checking", percent: 0, message: "" });
  });
  autoUpdater.on("update-available", (info) => {
    update({
      status: "available",
      latestVersion: info.version,
      message: info.releaseName || "",
      checkedAt: Date.now(),
    });
  });
  autoUpdater.on("update-not-available", (info) => {
    update({
      status: "not-available",
      latestVersion: info.version,
      message: "",
      checkedAt: Date.now(),
    });
  });
  autoUpdater.on("download-progress", (progress) => {
    update({
      status: "downloading",
      percent: Math.max(0, Math.min(100, Number(progress.percent || 0))),
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    update({
      status: "downloaded",
      latestVersion: info.version,
      percent: 100,
      checkedAt: Date.now(),
    });
  });
  autoUpdater.on("error", (reason) => {
    update({
      status: "error",
      message: reason instanceof Error ? reason.message : String(reason),
      checkedAt: Date.now(),
    });
  });

  async function check(manual = false) {
    if (!configureFeed()) {
      return update({
        status: repository ? "disabled" : "not-configured",
        message: repository
          ? "Updates are only available in an installed build"
          : "GitHub release repository is not configured",
        checkedAt: Date.now(),
      });
    }
    if (checkPromise) return checkPromise;
    state = {
      ...state,
      status: "checking",
      message: manual ? "" : state.message,
      checkedAt: Date.now(),
    };
    notify();
    checkPromise = autoUpdater
      .checkForUpdates()
      .catch((reason) => {
        update({
          status: "error",
          message: reason instanceof Error ? reason.message : String(reason),
          checkedAt: Date.now(),
        });
      })
      .finally(() => {
        checkPromise = null;
      });
    await checkPromise;
    return state;
  }

  async function download() {
    if (state.status !== "available") {
      return update({
        status: "error",
        message: "No downloaded update is ready",
      });
    }
    if (downloadPromise) return downloadPromise;
    downloadPromise = autoUpdater
      .downloadUpdate()
      .catch((reason) => {
        update({
          status: "error",
          message: reason instanceof Error ? reason.message : String(reason),
        });
      })
      .finally(() => {
        downloadPromise = null;
      });
    await downloadPromise;
    return state;
  }

  function install() {
    if (state.status !== "downloaded") {
      throw new Error("No downloaded update is ready to install");
    }
    autoUpdater.quitAndInstall(false, true);
  }

  ipcMain.handle("updates:get-state", (event) => {
    assertTrustedIpcSender(event);
    return state;
  });
  ipcMain.handle("updates:check", (event) => {
    assertTrustedIpcSender(event);
    return check(true);
  });
  ipcMain.handle("updates:download", (event) => {
    assertTrustedIpcSender(event);
    return download();
  });
  ipcMain.handle("updates:install", (event) => {
    assertTrustedIpcSender(event);
    install();
    return true;
  });

  if (repository && app.isPackaged) {
    setTimeout(() => void check(false), 12_000).unref();
  }

  return {
    check,
    getState: () => state,
  };
}

module.exports = {
  createUpdaterService,
};
