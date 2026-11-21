const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studyflow", {
  loadPersistentItem: (key) => ipcRenderer.invoke("storage:load", key),
  savePersistentItem: (key, value) =>
    ipcRenderer.invoke("storage:save", key, value),
  getRecommendations: (force = false) =>
    ipcRenderer.invoke("bili:get-recommendations", force),
  searchVideos: (keyword, page = 1) =>
    ipcRenderer.invoke("bili:search-videos", { keyword, page }),
  getLoginState: () => ipcRenderer.invoke("bili:get-login-state"),
  openOfficialLogin: () => ipcRenderer.invoke("bili:open-official-login"),
  getSubtitles: (bvid, cid) =>
    ipcRenderer.invoke("bili:get-subtitles", { bvid, cid }),
  getPlayback: (bvid, cid) =>
    ipcRenderer.invoke("bili:get-playback", { bvid, cid }),
  getDanmaku: (bvid, cid) =>
    ipcRenderer.invoke("bili:get-danmaku", { bvid, cid }),
  getVideoComments: (bvid, page = 1, pageSize = 20) =>
    ipcRenderer.invoke("bili:get-video-comments", { bvid, page, pageSize }),
  getCommentReplies: (bvid, root, page = 1) =>
    ipcRenderer.invoke("bili:get-comment-replies", { bvid, root, page }),
  getVideoCollection: (bvid) =>
    ipcRenderer.invoke("bili:get-video-collection", bvid),
  importGitHubLearningList: (url) =>
    ipcRenderer.invoke("learning:import-github", url),
  setPlaybackActive: (active) =>
    ipcRenderer.send("player:set-active", Boolean(active)),
  setMiniPlayer: (active) =>
    ipcRenderer.send("player:set-mini", Boolean(active)),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  openNoteLink: (url) => ipcRenderer.invoke("app:open-note-link", url),
  openCreatorStudio: () => ipcRenderer.invoke("app:open-creator-studio"),
  creatorSearchVideos: (keyword) =>
    ipcRenderer.invoke("studio:search-videos", keyword),
  creatorGetVideoParts: (bvid) =>
    ipcRenderer.invoke("studio:get-video-parts", bvid),
  creatorSaveToken: (token) => ipcRenderer.invoke("studio:save-token", token),
  creatorGetAuthState: () => ipcRenderer.invoke("studio:get-auth-state"),
  creatorClearToken: () => ipcRenderer.invoke("studio:clear-token"),
  creatorPublish: (payload) => ipcRenderer.invoke("studio:publish", payload),
  chooseScreenshotDirectory: (currentDirectory) =>
    ipcRenderer.invoke("screenshot:choose-directory", currentDirectory),
  getScreenshotDirectory: () =>
    ipcRenderer.invoke("screenshot:get-directory"),
  savePlayerScreenshot: (payload) =>
    ipcRenderer.invoke("screenshot:save", payload),
  getUpdateState: () => ipcRenderer.invoke("updates:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.send("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),
  onLoginChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("bili:login-changed", listener);
    return () => ipcRenderer.removeListener("bili:login-changed", listener);
  },
  onMiniPlayerChanged: (callback) => {
    const listener = (_event, active) => callback(Boolean(active));
    ipcRenderer.on("player:mini-changed", listener);
    return () => ipcRenderer.removeListener("player:mini-changed", listener);
  },
  onOpenCreatorMode: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:open-creator-mode", listener);
    return () => ipcRenderer.removeListener("app:open-creator-mode", listener);
  },
  onUpdateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("updates:changed", listener);
    return () => ipcRenderer.removeListener("updates:changed", listener);
  },
});
