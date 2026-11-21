import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { createPersistentStorage } = require("../../electron/storage.cjs");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("main-process persistent storage", () => {
  it("round-trips an allowed value with an atomic backup", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "studyflow-storage-"));
    temporaryDirectories.push(directory);
    const storage = createPersistentStorage(directory);
    storage.save("progress", { "BV1:1": { currentTime: 12 } });
    storage.save("progress", { "BV1:1": { currentTime: 20 } });
    expect(storage.load("progress")).toEqual({
      "BV1:1": { currentTime: 20 },
    });
    expect(
      fs.readdirSync(storage.rootDirectory).some((file) => file.endsWith(".bak")),
    ).toBe(true);
  });

  it("rejects arbitrary keys", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "studyflow-storage-"));
    temporaryDirectories.push(directory);
    const storage = createPersistentStorage(directory);
    expect(() => storage.save("../../outside", {})).toThrow(
      "Unsupported persistent storage key",
    );
  });
});
