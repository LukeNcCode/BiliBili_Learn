import { describe, expect, it } from "vitest";
import { normalizeOfflineLearningList } from "./offlineList";

const manifest = {
  version: 1,
  name: "离线英语课程",
  goal: "英式英语",
  author: "英语角维护组",
  createdAt: "2026-10-01T12:00",
  courses: [
    {
      title: "语音基础",
      sections: [
        {
          title: "第一单元",
          lessons: [
            {
              title: "连读",
              bvid: "BV1cTtr6oEZa",
              cid: 123,
              inclusion: "segments",
              segments: [{ start: 10, end: 45, title: "重点" }],
            },
          ],
        },
      ],
    },
  ],
};

describe("offline learning lists", () => {
  it("loads a local JSON manifest without repository metadata", () => {
    const list = normalizeOfflineLearningList(
      manifest,
      "english-course.json",
      100,
    );
    expect(list.source).toBe("local");
    expect(list.repository).toBe("english-course.json");
    expect(list.author).toBe("英语角维护组");
    expect(list.createdAt).toBe("2026-10-01T12:00");
    expect(list.manifestUrl).toBe("");
    expect(list.courses[0].sections[0].lessons[0].cid).toBe(123);
    expect(list.courses[0].sections[0].lessons[0].segments).toHaveLength(1);
  });

  it("uses a stable id for the same file content", () => {
    const first = normalizeOfflineLearningList(manifest, "course.json", 1);
    const second = normalizeOfflineLearningList(manifest, "course.json", 2);
    expect(second.id).toBe(first.id);
    expect(second.importedAt).toBe(2);
  });

  it("rejects files without a courses array", () => {
    expect(() =>
      normalizeOfflineLearningList({ name: "empty" }, "empty.json"),
    ).toThrow("courses");
  });

  it("rejects manifests without a playable lesson", () => {
    expect(() =>
      normalizeOfflineLearningList(
        { courses: [{ title: "空课程", sections: [] }] },
        "empty.json",
      ),
    ).toThrow("没有可用的");
  });
});
