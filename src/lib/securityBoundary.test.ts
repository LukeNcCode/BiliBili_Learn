import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const security = require("../../electron/security.cjs");

describe("desktop IPC security boundary", () => {
  it("only accepts the exact packaged application entry", () => {
    expect(security.isTrustedAppUrl(security.APP_ENTRY_URL)).toBe(true);
    expect(security.isTrustedAppUrl("file:///C:/Windows/System32/notepad.exe")).toBe(
      false,
    );
    expect(security.isTrustedAppUrl("https://example.com")).toBe(false);
  });

  it("restricts content links to Bilibili and GitHub", () => {
    expect(
      security.isAllowedContentUrl("https://www.bilibili.com/video/BV1xx411c7mD"),
    ).toBe(true);
    expect(
      security.isAllowedContentUrl(
        "https://github.com/example/learning-list/releases",
      ),
    ).toBe(true);
    expect(security.isAllowedContentUrl("https://example.com/phishing")).toBe(
      false,
    );
    expect(
      security.isAllowedContentUrl("https://user:pass@github.com/repo"),
    ).toBe(false);
  });
});
