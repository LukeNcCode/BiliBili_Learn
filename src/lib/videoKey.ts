import type { VideoCandidate } from "../types";

export function videoKey(video: Pick<VideoCandidate, "id" | "bvid">) {
  return video.bvid || video.id;
}
