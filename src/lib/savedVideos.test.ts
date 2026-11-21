import { describe, expect, it } from "vitest";
import { collectSavedVideos } from "./savedVideos";
import type { ClassifiedVideo } from "../types";
import { videoKey } from "./videoKey";

function video(id: string, bvid: string): ClassifiedVideo {
  return {
    id,
    bvid,
    title: id,
    description: "",
    cover: "",
    author: "",
    authorId: "",
    duration: 60,
    publishedAt: 0,
    views: 0,
    likes: 0,
    category: "",
    tags: [],
    position: 0,
    recommendReason: "",
    source: "bilibili",
    learningScore: 1,
    subject: "general",
    route: "learning",
    reasons: [],
    hidden: false,
    feedback: 0,
  };
}

describe("saved videos", () => {
  it("uses BVID or the video id as the stable saved key", () => {
    expect(videoKey(video("demo-id", ""))).toBe("demo-id");
    expect(videoKey(video("other-id", "BV1saved"))).toBe("BV1saved");
  });

  it("keeps a searched video that is not in the recommendation catalog", () => {
    const searched = video("search-only", "BV1search");
    const catalog = video("catalog", "BV1catalog");

    expect(
      collectSavedVideos(
        [videoKey(searched), videoKey(catalog)],
        [catalog, searched],
      ).map((item) => item.id),
    ).toEqual(["search-only", "catalog"]);
  });
});
