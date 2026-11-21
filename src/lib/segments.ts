import type { LearningSegment } from "../types";

export function resolveSegmentPosition(
  position: number,
  segments: LearningSegment[],
  enabled: boolean,
) {
  if (!enabled || segments.length === 0) {
    return { target: position, ended: false };
  }
  const ordered = [...segments]
    .filter((segment) => segment.end > segment.start)
    .sort((left, right) => left.start - right.start);
  if (ordered.length === 0) {
    return { target: position, ended: false };
  }
  const activeSegment = ordered.find(
    (segment) => position >= segment.start && position < segment.end,
  );
  if (activeSegment) return { target: position, ended: false };

  const nextSegment = ordered.find((segment) => position < segment.start);
  if (nextSegment) {
    return { target: nextSegment.start, ended: false };
  }
  return { target: ordered[ordered.length - 1].end, ended: true };
}
