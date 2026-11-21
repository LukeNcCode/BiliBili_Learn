import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  DEFAULT_UPDATE_REPOSITORY,
  normalizeRepository,
} = require("../../electron/update-repository.cjs");

describe("update repository normalization", () => {
  it("accepts owner/repository values", () => {
    expect(normalizeRepository("LukeNcCode/BiliBili_Learn")).toBe(
      "LukeNcCode/BiliBili_Learn",
    );
    expect(normalizeRepository("LukeNcCode/BiliBili_Learn.git")).toBe(
      "LukeNcCode/BiliBili_Learn",
    );
  });

  it("accepts GitHub URLs and rejects unrelated values", () => {
    expect(
      normalizeRepository(
        "https://github.com/LukeNcCode/BiliBili_Learn/releases",
      ),
    ).toBe("LukeNcCode/BiliBili_Learn");
    expect(normalizeRepository("https://example.com/owner/repo")).toBe("");
  });

  it("uses the official repository as the packaged default", () => {
    expect(DEFAULT_UPDATE_REPOSITORY).toBe("LukeNcCode/BiliBili_Learn");
  });
});
