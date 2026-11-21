import { describe, expect, it } from "vitest";
import type {
  ImportedLearningList,
  VideoCandidate,
} from "../types";
import {
  createLearningAffinityIndex,
  learningTextTokens,
} from "./learningAffinity";

function createList(): ImportedLearningList {
  return {
    id: "medicine-law",
    name: "医学与法学基础清单",
    description: "面向大学低年级的基础课程",
    goal: "系统学习",
    author: "",
    createdAt: "",
    sourceUrl: "",
    manifestUrl: "",
    repository: "",
    importedAt: 1,
    courses: [
      {
        id: "internal-medicine",
        title: "内科学",
        description: "呼吸系统与心血管系统",
        cover: "",
        author: "医学院",
        sections: [
          {
            id: "section-1",
            title: "呼吸系统",
            lessons: [
              {
                id: "lesson-1",
                title: "肺炎的诊断与治疗",
                bvid: "BV1medical",
                cid: 1,
                page: 1,
                url: "",
                duration: 1800,
                cover: "",
                description: "",
                inclusion: "full",
                segments: [],
              },
            ],
          },
        ],
      },
      {
        id: "civil-law",
        title: "民法总则",
        description: "民事法律关系与法律行为",
        cover: "",
        author: "法学院",
        sections: [
          {
            id: "section-2",
            title: "民事法律行为",
            lessons: [
              {
                id: "lesson-2",
                title: "意思表示与合同成立",
                bvid: "BV1law",
                cid: 2,
                page: 1,
                url: "",
                duration: 1600,
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

function video(title: string, tags: string[], bvid = "BV1new"): VideoCandidate {
  return {
    id: bvid,
    bvid,
    title,
    description: "",
    cover: "",
    author: "",
    authorId: "",
    duration: 1200,
    publishedAt: 0,
    views: 0,
    likes: 0,
    category: "知识",
    tags,
    position: 0,
    recommendReason: "",
    source: "bilibili",
  };
}

describe("learning-list affinity", () => {
  it("extracts Chinese topic phrases while ignoring generic course words", () => {
    const tokens = learningTextTokens("医学课程入门教程");

    expect(tokens).toContain("医学");
    expect(tokens).not.toContain("课程");
    expect(tokens).not.toContain("教程");
  });

  it("matches a related course even when the title is not identical", () => {
    const index = createLearningAffinityIndex([createList()]);
    const match = index.match(
      video("民法法律行为精讲：合同如何成立", ["法学", "法考"]),
    );

    expect(match).not.toBeNull();
    expect(match?.courseTitle).toBe("民法总则");
    expect(match?.score).toBeGreaterThan(0.05);
  });

  it("treats an imported BVID as an exact learning anchor", () => {
    const index = createLearningAffinityIndex([createList()]);
    const match = index.match(video("完全不同的标题", [], "bv1medical"));

    expect(match?.exactVideo).toBe(true);
    expect(match?.listName).toBe("医学与法学基础清单");
    expect(match?.score).toBe(1);
  });

  it("does not return a match without imported list anchors", () => {
    const index = createLearningAffinityIndex([]);

    expect(index.match(video("线性代数", ["数学"]))).toBeNull();
  });
});
