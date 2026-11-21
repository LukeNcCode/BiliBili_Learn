const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MAX_ITEM_BYTES = 32 * 1024 * 1024;
const STORAGE_VERSION = 1;
const ALLOWED_KEYS = new Set([
  "feedback",
  "saved",
  "saved-snapshots",
  "history",
  "progress",
  "learning-lists",
  "watch-time",
]);

function createPersistentStorage(userDataPath) {
  const rootDirectory = path.join(userDataPath, "learning-data-v1");

  function assertKey(key) {
    const value = String(key || "");
    if (
      !value ||
      value.length > 240 ||
      (!ALLOWED_KEYS.has(value) && !value.startsWith("courseNotes."))
    ) {
      throw new Error("Unsupported persistent storage key");
    }
    return value;
  }

  function filePathForKey(key) {
    const safeKey = assertKey(key);
    const digest = crypto.createHash("sha256").update(safeKey).digest("hex");
    return path.join(rootDirectory, `${digest}.json`);
  }

  function load(key) {
    const filePath = filePathForKey(key);
    if (!fs.existsSync(filePath)) return null;
    try {
      const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (
        !payload ||
        payload.version !== STORAGE_VERSION ||
        payload.key !== key ||
        !Object.prototype.hasOwnProperty.call(payload, "value")
      ) {
        return null;
      }
      return payload.value;
    } catch {
      return null;
    }
  }

  function save(key, value) {
    const safeKey = assertKey(key);
    const serialized = JSON.stringify({
      version: STORAGE_VERSION,
      key: safeKey,
      savedAt: Date.now(),
      value,
    });
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes > MAX_ITEM_BYTES) {
      throw new Error("Persistent storage entry is too large");
    }

    fs.mkdirSync(rootDirectory, { recursive: true });
    const filePath = filePathForKey(safeKey);
    const temporaryPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;
    fs.writeFileSync(temporaryPath, serialized, "utf8");
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
    }
    try {
      fs.renameSync(temporaryPath, filePath);
    } catch (error) {
      if (!["EEXIST", "EPERM"].includes(error?.code)) throw error;
      fs.rmSync(filePath, { force: true });
      fs.renameSync(temporaryPath, filePath);
    }
    return { bytes, savedAt: Date.now() };
  }

  return {
    load,
    save,
    rootDirectory,
  };
}

module.exports = {
  createPersistentStorage,
};
