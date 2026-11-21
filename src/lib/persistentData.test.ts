import { describe, expect, it } from "vitest";
import {
  normalizeLearningLists,
  normalizeProgressMap,
  normalizeStringList,
} from "./persistentData";

describe("persistent data normalization", () => {
  it("drops invalid progress values", () => {
    expect(
      normalizeProgressMap({
        valid: {
          key: "BV1:1",
          bvid: "BV1",
          cid: 1,
          currentTime: 20,
          duration: 10,
          completed: false,
          updatedAt: 1,
        },
        invalid: { bvid: "BV2", cid: 0, currentTime: "NaN" },
      }),
    ).toEqual({
      valid: {
        key: "BV1:1",
        bvid: "BV1",
        cid: 1,
        currentTime: 10,
        duration: 10,
        completed: false,
        updatedAt: 1,
      },
    });
  });

  it("deduplicates and limits string lists", () => {
    expect(normalizeStringList(["a", "a", " b ", null])).toEqual(["a", "b"]);
  });

  it("repairs duplicate learning-list lesson ids", () => {
    const lists = normalizeLearningLists([
      {
        id: "list",
        name: "Course",
        courses: [
          {
            id: "course",
            title: "Course",
            sections: [
              {
                id: "section",
                title: "Section",
                lessons: [
                  { id: "same", bvid: "BV1xx411c7mD", title: "One" },
                  { id: "same", bvid: "BV1xx411c7mD", title: "Two" },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const lessons = lists[0].courses[0].sections[0].lessons;
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(2);
  });
});
