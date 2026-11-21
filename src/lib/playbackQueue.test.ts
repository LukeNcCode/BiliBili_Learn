import { describe, expect, it } from "vitest";
import { buildVideoPartQueue } from "./playbackQueue";
import type { VideoCollection } from "../types";

describe("playback queue", () => {
  it("expands every part of the current video without adding other series episodes", () => {
    const collection: VideoCollection = {
      id: "season",
      title: "IELTS",
      cover: "",
      kind: "ugc-season",
      total: 2,
      sections: [
        {
          id: "main",
          title: "正片",
          episodes: [
            {
              id: "episode-1",
              bvid: "BV1first",
              cid: 1,
              title: "Part 1",
              duration: 60,
              cover: "",
              index: 1,
              variants: [],
            },
            {
              id: "episode-2",
              bvid: "BV1collection",
              cid: 10,
              title: "题库合集",
              duration: 30,
              cover: "",
              index: 2,
              variants: [
                { id: "10", cid: 10, title: "片头", duration: 30 },
                { id: "11", cid: 11, title: "Part 1", duration: 40 },
              ],
            },
          ],
        },
      ],
    };

    expect(
      buildVideoPartQueue(collection, collection.sections[0].episodes[1]).map(
        (item) => item.cid,
      ),
    ).toEqual([10, 11]);
  });
});
