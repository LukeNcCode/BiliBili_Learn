import { describe, expect, it } from "vitest";
import {
  enabledLearningSubjects,
  isSubjectScopeEnabled,
} from "./subjects";

describe("learning subject scope", () => {
  it("keeps general language learning when medicine is disabled", () => {
    expect(
      isSubjectScopeEnabled(
        "language",
        ["language"],
        ["language", "programming"],
      ),
    ).toBe(true);
  });

  it("hides medical English when the medicine subject is disabled", () => {
    expect(
      isSubjectScopeEnabled(
        "language",
        ["language", "medicine"],
        ["language", "programming"],
      ),
    ).toBe(false);
  });

  it("falls back to every subject for legacy empty preferences", () => {
    expect(enabledLearningSubjects([]).length).toBeGreaterThan(5);
  });
});
