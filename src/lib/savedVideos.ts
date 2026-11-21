import type { ClassifiedVideo } from "../types";
import { videoKey } from "./videoKey";

export function collectSavedVideos(
  savedKeys: string[],
  sources: ClassifiedVideo[],
) {
  const known = new Map<string, ClassifiedVideo>();
  sources.forEach((video) => known.set(videoKey(video), video));
  return savedKeys.flatMap((key) => {
    const video = known.get(key);
    return video ? [video] : [];
  });
}
