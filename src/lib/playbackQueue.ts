import type {
  CollectionEpisode,
  CollectionVariant,
  VideoCollection,
} from "../types";

export interface PlaybackQueueItem {
  key: string;
  sectionId: string;
  sectionTitle: string;
  episode: CollectionEpisode;
  variant: CollectionVariant | null;
  cid: number | null;
  title: string;
  duration: number;
}

export function buildVideoPartQueue(
  collection: VideoCollection | null,
  currentEpisode: CollectionEpisode | null,
): PlaybackQueueItem[] {
  if (!collection || !currentEpisode) return [];
  const matchingEpisodes = collection.sections.flatMap((section) =>
    section.episodes
      .filter((episode) => episode.bvid === currentEpisode.bvid)
      .map((episode) => ({ section, episode })),
  );
  if (currentEpisode.variants.length > 1) {
    const section = matchingEpisodes[0]?.section;
    return currentEpisode.variants.map((variant) => ({
      key: `${currentEpisode.id}:${variant.cid}`,
      sectionId: section?.id || "",
      sectionTitle: section?.title || "",
      episode: currentEpisode,
      variant,
      cid: variant.cid,
      title: variant.title,
      duration: variant.duration,
    }));
  }
  if (matchingEpisodes.length > 1) {
    return matchingEpisodes.map(({ section, episode }) => ({
      key: `${episode.id}:${episode.cid || "main"}`,
      sectionId: section.id,
      sectionTitle: section.title,
      episode,
      variant: null,
      cid: episode.cid,
      title: episode.title,
      duration: episode.duration,
    }));
  }
  const variant = currentEpisode.variants[0] || null;
  const section = matchingEpisodes[0]?.section;
  return [
    {
      key: `${currentEpisode.id}:${currentEpisode.cid || "main"}`,
      sectionId: section?.id || "",
      sectionTitle: section?.title || "",
      episode: currentEpisode,
      variant,
      cid: variant?.cid || currentEpisode.cid,
      title: variant?.title || currentEpisode.title,
      duration: variant?.duration || currentEpisode.duration,
    },
  ];
}
