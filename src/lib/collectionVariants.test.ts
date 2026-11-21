import { describe, expect, it } from "vitest";
import { groupCollectionVariants } from "./collectionVariants";
import type { CollectionVariant } from "../types";

function variant(id: string, title: string): CollectionVariant {
  return { id, cid: Number(id), title, duration: 60 };
}

describe("collection variant grouping", () => {
  it("groups a long IELTS part list into readable sections", () => {
    const groups = groupCollectionVariants(
      [
        variant("1", "5~8月大合集使用指南"),
        variant("2", "part1 Teachers （新题）"),
        variant("3", "Part1 Day off （保留题）"),
        variant("4", "part2 串题（话题1）"),
        variant("5", "part2 难题（难题1）"),
        variant("6", "part3 话题1（Education）"),
      ],
      "zh",
    );

    expect(groups.map((group) => group.label)).toEqual([
      "其他分P",
      "Part 1",
      "Part 2",
      "Part 3",
    ]);
  });

  it("keeps variants in their original order within each group", () => {
    const groups = groupCollectionVariants(
      [
        variant("1", "part1 Teachers"),
        variant("2", "part1 Food"),
        variant("3", "part2 串题"),
      ],
      "en",
    );

    expect(groups[0].variants.map((item) => item.title)).toEqual([
      "part1 Teachers",
      "part1 Food",
    ]);
    expect(groups[1].label).toBe("Part 2");
  });

  it("groups upper and lower halves by Chinese lesson number", () => {
    const groups = groupCollectionVariants(
      [
        variant("1", "第01节课自动控制的一般概念（上）"),
        variant("2", "第01节课自动控制的一般概念（下）"),
        variant("3", "第3节课控制系统的数学模型（上）"),
        variant("4", "第3节课控制系统的数学模型（下）"),
      ],
      "zh",
    );

    expect(groups.map((group) => group.label)).toEqual([
      "第 1 节课",
      "第 3 节课",
    ]);
    expect(groups[0].variants).toHaveLength(2);
    expect(groups[1].variants).toHaveLength(2);
  });

  it("splits oversized groups using generic short parenthetical tags", () => {
    const groups = groupCollectionVariants(
      [
        ...Array.from({ length: 9 }, (_, index) =>
          variant(`${index + 1}`, `Part 1 Topic ${index + 1}（新题）`),
        ),
        ...Array.from({ length: 9 }, (_, index) =>
          variant(`${index + 20}`, `Part 1 Topic ${index + 1}（保留题）`),
        ),
      ],
      "zh",
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Part 1 · 新题",
      "Part 1 · 保留题",
    ]);
  });
});
