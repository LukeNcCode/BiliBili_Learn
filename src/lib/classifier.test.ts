import { describe, expect, it } from "vitest";
import { demoFeed } from "../data/demoFeed";
import { learningSeeds } from "../data/learningSeeds";
import {
  applySemanticSubject,
  classifyFeed,
  classifyVideo,
} from "./classifier";
import { createLearningAffinityIndex } from "./learningAffinity";

describe("learning feed classifier", () => {
  it("routes a complete programming course into the learning feed", () => {
    const video = demoFeed.find((item) => item.id === "demo-python")!;
    const result = classifyVideo(video, "balanced", 0, []);

    expect(result.hidden).toBe(false);
    expect(result.subject).toBe("programming");
    expect(result.route).toBe("learning");
    expect(result.learningScore).toBeGreaterThanOrEqual(0.62);
  });

  it("filters entertainment and promotional candidates", () => {
    const classified = classifyFeed(demoFeed, "balanced", {}, []);
    const entertainment = classified.find(
      (item) => item.id === "demo-entertainment",
    )!;
    const advertisement = classified.find((item) => item.id === "demo-ad")!;

    expect(entertainment.hidden).toBe(true);
    expect(entertainment.route).toBe("entertainment");
    expect(advertisement.hidden).toBe(true);
    expect(advertisement.route).toBe("ad");
  });

  it("increases ranking when the learner marks content as useful", () => {
    const video = demoFeed.find((item) => item.id === "demo-english")!;
    const neutral = classifyVideo(video, "balanced", 0, []);
    const useful = classifyVideo(video, "balanced", 1, []);

    expect(useful.learningScore).toBeGreaterThan(neutral.learningScore);
    expect(useful.reasons).toContain("reasonFeedback");
  });

  it("hides every video from a blocked creator", () => {
    const video = demoFeed.find((item) => item.id === "demo-python")!;
    const result = classifyVideo(video, "balanced", 0, [video.author]);

    expect(result.hidden).toBe(true);
  });

  it("keeps the curated Bilibili learning supplement visible", () => {
    const classified = classifyFeed(learningSeeds, "balanced", {}, []);

    expect(classified.filter((item) => !item.hidden)).toHaveLength(
      learningSeeds.length,
    );
  });

  it.each([
    ["内科学 呼吸系统 第3讲 肺炎诊断与治疗", "medicine"],
    ["系统解剖学：运动系统与骨骼结构", "medicine"],
    ["民法总则精讲：第2讲 民事法律行为", "law"],
    ["考研政治系统课：马克思主义基本原理", "politics"],
    ["心理学导论公开课：记忆与认知", "humanities"],
    ["宏观经济学入门：国民收入与通货膨胀", "business"],
    ["经典控制理论：系统建模、根轨迹与频域分析", "engineering"],
    ["耶鲁大学公开课：博弈论与策略分析", "math"],
  ] as const)("recognizes the broad learning subject %s", (title, subject) => {
    const result = classifyVideo(
      {
        id: title,
        bvid: "BV1subject",
        title,
        description: "",
        cover: "",
        author: "",
        authorId: "",
        duration: 2400,
        publishedAt: 0,
        views: 0,
        likes: 0,
        category: "知识",
        tags: [],
        position: 0,
        recommendReason: "",
        source: "bilibili",
      },
      "balanced",
      0,
      [],
    );

    expect(result.subject).toBe(subject);
    expect(result.hidden).toBe(false);
  });

  it("prioritizes videos explicitly included in a loaded learning list", () => {
    const video = {
      ...demoFeed.find((item) => item.id === "demo-python")!,
      bvid: "BV1listed",
    };
    const affinity = createLearningAffinityIndex([
      {
        id: "list",
        name: "课程清单",
        description: "",
        goal: "",
        sourceUrl: "",
        manifestUrl: "",
        repository: "",
        importedAt: 1,
        courses: [
          {
            id: "course",
            title: "课程",
            description: "",
            cover: "",
            author: "",
            sections: [
              {
                id: "section",
                title: "章节",
                lessons: [
                  {
                    id: "lesson",
                    title: "已选课程",
                    bvid: "BV1listed",
                    cid: 1,
                    page: 1,
                    url: "",
                    duration: 600,
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
      },
    ]);
    const result = classifyVideo(video, "balanced", 0, [], affinity);

    expect(result.hidden).toBe(false);
    expect(result.reasons).toContain("reasonLearningList");
    expect(result.learningScore).toBeGreaterThanOrEqual(0.78);
  });

  it("lets a confident local semantic result correct the keyword subject", () => {
    const classified = classifyVideo(
      {
        ...demoFeed.find((item) => item.id === "demo-python")!,
        title: "细胞结构与功能",
        category: "科学",
        tags: ["生物学"],
      },
      "balanced",
      0,
      [],
    );
    const corrected = applySemanticSubject(classified, {
      bvid: classified.bvid,
      subject: "medicine",
      score: 0.64,
      margin: 0.12,
    });

    expect(corrected.subject).toBe("medicine");
    expect(corrected.reasons).toContain("reasonSemantic");
  });

  it("prioritizes the video title over noisy channel and description tags", () => {
    const result = classifyVideo(
      {
        ...demoFeed.find((item) => item.id === "demo-python")!,
        title: "耶鲁大学公开课：博弈论与策略分析",
        description: "英语口语频道推荐，适合英语学习和翻译练习。",
        category: "科学科普",
        tags: ["英语", "口语", "翻译"],
      },
      "balanced",
      0,
      [],
    );

    expect(result.subject).toBe("math");
  });

  it("records applied cross-domain subjects such as medical English", () => {
    const result = classifyVideo(
      {
        ...demoFeed.find((item) => item.id === "demo-english")!,
        title: "医学英语专业词汇：临床沟通与病例表达",
        tags: ["医学英语", "英语学习", "医学"],
      },
      "balanced",
      0,
      [],
    );

    expect(result.topics).toContain("language");
    expect(result.topics).toContain("medicine");
  });
});
