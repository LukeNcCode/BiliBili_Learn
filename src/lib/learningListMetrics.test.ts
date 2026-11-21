import { describe, expect, it } from "vitest";
import {
  learningListDuration,
  lessonPlannedDuration,
  sumLessonDurations,
} from "./learningListMetrics";
import type { ImportedLearningList, LearningLesson } from "../types";

function lesson(
  id: string,
  duration: number,
  inclusion: LearningLesson["inclusion"] = "full",
  segments: LearningLesson["segments"] = [],
): LearningLesson {
  return {
    id,
    title: id,
    bvid: `BV${id}`,
    cid: 1,
    page: 1,
    url: "",
    duration,
    cover: "",
    description: "",
    inclusion,
    segments,
  };
}

describe("learning list duration", () => {
  it("uses selected segment duration for clipped videos", () => {
    const clipped = lesson("clip", 600, "segments", [
      { id: "a", start: 10, end: 40, title: "A" },
      { id: "b", start: 100, end: 130, title: "B" },
    ]);

    expect(lessonPlannedDuration(clipped)).toBe(60);
    expect(sumLessonDurations([clipped, lesson("full", 120)])).toBe(180);
  });

  it("sums course and section durations for a complete list", () => {
    const list = {
      courses: [
        {
          id: "course",
          title: "Course",
          description: "",
          cover: "",
          author: "",
          sections: [
            {
              id: "section",
              title: "Section",
              lessons: [lesson("one", 90), lesson("two", 30)],
            },
          ],
        },
      ],
    } as ImportedLearningList;

    expect(learningListDuration(list)).toBe(120);
  });
});
