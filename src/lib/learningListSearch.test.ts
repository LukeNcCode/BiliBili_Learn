import { describe, expect, it } from "vitest";
import { searchLearningLists } from "./learningListSearch";
import type { ImportedLearningList } from "../types";

function createList(): ImportedLearningList {
  return {
    id: "list-1",
    name: "大学数学复习",
    description: "高数与线性代数",
    goal: "期末考试",
    author: "数学社",
    createdAt: "2026-11-01T10:00",
    sourceUrl: "",
    manifestUrl: "",
    repository: "student/math-list",
    importedAt: 1,
    courses: [
      {
        id: "course-1",
        title: "线性代数",
        description: "矩阵与向量",
        cover: "",
        author: "数学老师",
        sections: [
          {
            id: "section-1",
            title: "第一章",
            lessons: [
              {
                id: "lesson-1",
                title: "矩阵的秩",
                bvid: "BV1matrix",
                cid: 1,
                page: 1,
                url: "https://www.bilibili.com/video/BV1matrix",
                duration: 600,
                cover: "",
                description: "",
                inclusion: "full",
                segments: [],
              },
              {
                id: "lesson-2",
                title: "特征值",
                bvid: "BV1eigen",
                cid: 2,
                page: 2,
                url: "https://www.bilibili.com/video/BV1eigen",
                duration: 700,
                cover: "",
                description: "",
                inclusion: "full",
                segments: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("learning list search", () => {
  it("matches a single video title and keeps its parent hierarchy", () => {
    const results = searchLearningLists([createList()], "秩");

    expect(results).toHaveLength(1);
    expect(results[0].courses[0].course.title).toBe("线性代数");
    expect(results[0].courses[0].sections[0].lessons).toHaveLength(1);
    expect(results[0].courses[0].sections[0].lessons[0].title).toBe("矩阵的秩");
  });

  it("returns the full list when list metadata matches", () => {
    const results = searchLearningLists([createList()], "期末");

    expect(results[0].courses[0].sections[0].lessons).toHaveLength(2);
  });

  it("matches course and BVID queries case-insensitively", () => {
    expect(searchLearningLists([createList()], "线性代数")).toHaveLength(1);
    expect(searchLearningLists([createList()], "数学社")).toHaveLength(1);
    expect(
      searchLearningLists([createList()], "bv1EIGEN")[0].courses[0].sections[0]
        .lessons,
    ).toHaveLength(1);
  });
});
