import { describe, expect, it } from "vitest";
import type { VideoCollection } from "../types";
import {
  countCollectionPlayableParts,
  createMultiPartCollection,
  expandCollectionEpisodes,
  expandCollectionSections,
  hasNavigableCollectionStructure,
} from "./videoCollection";

function collectionWithParts(partCount: number): VideoCollection {
  return {
    id: "single-video-series",
    title: "Course series",
    cover: "",
    kind: "ugc-season",
    total: 1,
    sections: [
      {
        id: "main",
        title: "Contents",
        episodes: [
          {
            id: "episode",
            bvid: "BV1example",
            cid: 100,
            title: "Course video",
            duration: 60,
            cover: "",
            index: 1,
            variants: Array.from({ length: partCount }, (_, index) => ({
              id: String(100 + index),
              cid: 100 + index,
              title: `Lesson ${index + 1}`,
              duration: 90 + index,
            })),
          },
        ],
      },
    ],
  };
}

describe("video collection structure", () => {
  it("treats one video with multiple parts as navigable", () => {
    const collection = collectionWithParts(80);

    expect(hasNavigableCollectionStructure(collection)).toBe(true);
    expect(countCollectionPlayableParts(collection)).toBe(80);
  });

  it("treats a genuinely single-part video as a single video", () => {
    const collection = collectionWithParts(1);

    expect(hasNavigableCollectionStructure(collection)).toBe(false);
    expect(countCollectionPlayableParts(collection)).toBe(1);
  });

  it("counts episodes across separate collection sections", () => {
    const collection = collectionWithParts(1);
    collection.sections.push({
      id: "second",
      title: "Second section",
      episodes: [
        {
          ...collection.sections[0].episodes[0],
          id: "episode-2",
          bvid: "BV1second",
          cid: 200,
          variants: [],
        },
      ],
    });

    expect(hasNavigableCollectionStructure(collection)).toBe(true);
    expect(countCollectionPlayableParts(collection)).toBe(2);
  });

  it("expands parts generically for selection without relying on titles", () => {
    const parts = expandCollectionEpisodes(collectionWithParts(3));

    expect(parts.map((part) => part.title)).toEqual([
      "Lesson 1",
      "Lesson 2",
      "Lesson 3",
    ]);
    expect(parts.map((part) => part.cid)).toEqual([100, 101, 102]);
    expect(parts.map((part) => part.index)).toEqual([1, 2, 3]);
    expect(new Set(parts.map((part) => part.id)).size).toBe(3);
  });

  it("expands nested parts in the sections rendered by creator mode", () => {
    const sections = expandCollectionSections(collectionWithParts(2));

    expect(sections).toHaveLength(1);
    expect(sections[0].episodes.map((episode) => episode.title)).toEqual([
      "Lesson 1",
      "Lesson 2",
    ]);
    expect(sections[0].episodes.map((episode) => episode.cid)).toEqual([
      100, 101,
    ]);
  });

  it("builds a navigable collection from a multi-part snapshot", () => {
    const collection = createMultiPartCollection({
      bvid: "BV1fallback",
      title: "Course video",
      cover: "cover.jpg",
      parts: Array.from({ length: 80 }, (_, index) => ({
        cid: 1000 + index,
        page: index + 1,
        title: `Part ${index + 1}`,
        duration: 60,
      })),
    });

    expect(collection).not.toBeNull();
    expect(hasNavigableCollectionStructure(collection)).toBe(true);
    expect(countCollectionPlayableParts(collection)).toBe(80);
    expect(collection?.sections[0].episodes[79].cid).toBe(1079);
  });

  it("does not turn a single-part snapshot into a collection", () => {
    expect(
      createMultiPartCollection({
        bvid: "BV1single",
        title: "Single video",
        cover: "",
        parts: [{ cid: 10, page: 1, title: "Main", duration: 60 }],
      }),
    ).toBeNull();
  });
});
