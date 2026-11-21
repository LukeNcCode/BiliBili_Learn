import { describe, expect, it } from "vitest";
import { resolveSegmentPosition } from "./segments";

const segments = [
  { id: "one", start: 10, end: 20, title: "One" },
  { id: "two", start: 30, end: 40, title: "Two" },
];

describe("learning-list segment playback", () => {
  it("plays inside a selected range", () => {
    expect(resolveSegmentPosition(15, segments, true)).toEqual({
      target: 15,
      ended: false,
    });
  });

  it("skips toward the next selected range", () => {
    expect(resolveSegmentPosition(23, segments, true)).toEqual({
      target: 30,
      ended: false,
    });
  });

  it("jumps to the first selected range when starting earlier", () => {
    expect(resolveSegmentPosition(2, segments, true)).toEqual({
      target: 10,
      ended: false,
    });
  });

  it("ends after the final selected range", () => {
    expect(resolveSegmentPosition(44, segments, true)).toEqual({
      target: 40,
      ended: true,
    });
  });

  it("does not modify playback when segment mode is disabled", () => {
    expect(resolveSegmentPosition(23, segments, false)).toEqual({
      target: 23,
      ended: false,
    });
  });
});
