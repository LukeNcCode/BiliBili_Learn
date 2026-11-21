import type {
  CollectionEpisode,
  CollectionSection,
  VideoCollection,
} from "../types";

export interface VideoPartSnapshot {
  cid: number;
  page: number;
  title: string;
  duration: number;
}

export function hasNavigableCollectionStructure(
  collection: VideoCollection | null,
) {
  if (!collection) return false;
  const episodeCount = collection.sections.reduce(
    (total, section) => total + section.episodes.length,
    0,
  );
  return (
    episodeCount > 1 ||
    collection.sections.some((section) =>
      section.episodes.some((episode) => episode.variants.length > 1),
    )
  );
}

export function createMultiPartCollection(
  input: {
    bvid: string;
    title: string;
    cover: string;
    parts: VideoPartSnapshot[];
  },
): VideoCollection | null {
  const parts = input.parts.filter((part) => Number(part.cid) > 0);
  if (parts.length <= 1) return null;

  return {
    id: `multi-${input.bvid}`,
    title: input.title,
    cover: input.cover,
    kind: "multi-part",
    total: parts.length,
    sections: [
      {
        id: "parts",
        title: "分P",
        episodes: parts.map((part, index) => ({
          id: `${input.bvid}:${part.cid}`,
          bvid: input.bvid,
          cid: Number(part.cid),
          title: part.title || `P${part.page || index + 1}`,
          duration: Number(part.duration || 0),
          cover: input.cover,
          index: Number(part.page || index + 1),
          variants: [],
        })),
      },
    ],
  };
}

export function countCollectionPlayableParts(
  collection: VideoCollection | null,
) {
  if (!collection) return 0;
  return collection.sections.reduce(
    (sectionTotal, section) =>
      sectionTotal +
      section.episodes.reduce(
        (episodeTotal, episode) =>
          episodeTotal + Math.max(1, episode.variants.length),
        0,
      ),
    0,
  );
}

export function expandCollectionEpisodes(
  collection: VideoCollection | null,
): CollectionEpisode[] {
  return expandCollectionSections(collection).flatMap(
    (section) => section.episodes,
  );
}

export function expandCollectionSections(
  collection: VideoCollection | null,
): CollectionSection[] {
  if (!collection) return [];
  let runningIndex = 0;

  return collection.sections.map((section) => ({
    ...section,
    episodes: section.episodes.flatMap((episode) => {
      if (episode.variants.length <= 1) {
        runningIndex += 1;
        return [{ ...episode, index: runningIndex }];
      }

      return episode.variants.map((variant) => {
        runningIndex += 1;
        return {
          ...episode,
          id: `${episode.id}:part:${variant.id}`,
          cid: variant.cid,
          title: variant.title,
          duration: variant.duration,
          index: runningIndex,
          variants: [],
        };
      });
    }),
  }));
}
