import { describe, expect, it } from "vitest";
import {
  createTimelineRange,
  moveTimelineRange,
  resizeTimelineRange,
  timelinePercent,
} from "./timeline";

describe("timeline range math", () => {
  it("maps real video time to the track percentage", () => {
    expect(timelinePercent(0, 120)).toBe(0);
    expect(timelinePercent(30, 120)).toBe(25);
    expect(timelinePercent(120, 120)).toBe(100);
  });

  it("creates a range from a drag and a default-length range from a click", () => {
    expect(createTimelineRange(40, 80, 120)).toEqual({
      start: 40,
      end: 80,
    });
    expect(createTimelineRange(115, 115, 120)).toEqual({
      start: 110,
      end: 120,
    });
  });

  it("moves a segment without changing its length", () => {
    expect(moveTimelineRange({ start: 20, end: 40 }, 100, 120)).toEqual({
      start: 100,
      end: 120,
    });
  });

  it("resizes either edge while respecting the video duration", () => {
    expect(
      resizeTimelineRange({ start: 20, end: 40 }, "start", 8, 120),
    ).toEqual({ start: 8, end: 40 });
    expect(
      resizeTimelineRange({ start: 20, end: 40 }, "end", 180, 120),
    ).toEqual({ start: 20, end: 120 });
  });
});
