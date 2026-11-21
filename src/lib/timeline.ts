export interface TimelineRange {
  start: number;
  end: number;
}

export function clampTimelineTime(value: number, duration: number) {
  if (!Number.isFinite(value) || duration <= 0) return 0;
  return Math.max(0, Math.min(value, duration));
}

export function moveTimelineRange(
  range: TimelineRange,
  delta: number,
  duration: number,
): TimelineRange {
  const safeDuration = Math.max(0, duration);
  const length = Math.min(
    Math.max(0, range.end - range.start),
    safeDuration,
  );
  const start = clampTimelineTime(
    range.start + delta,
    Math.max(0, safeDuration - length),
  );
  return { start, end: start + length };
}

export function resizeTimelineRange(
  range: TimelineRange,
  edge: "start" | "end",
  targetTime: number,
  duration: number,
  minimumLength = 0.5,
): TimelineRange {
  const safeDuration = Math.max(0, duration);
  const time = clampTimelineTime(targetTime, safeDuration);
  if (edge === "start") {
    return {
      start: Math.min(time, Math.max(0, range.end - minimumLength)),
      end: Math.min(range.end, safeDuration),
    };
  }
  return {
    start: Math.max(0, range.start),
    end: Math.max(time, Math.min(safeDuration, range.start + minimumLength)),
  };
}

export function timelinePercent(time: number, duration: number) {
  if (duration <= 0) return 0;
  return (clampTimelineTime(time, duration) / duration) * 100;
}

export function createTimelineRange(
  anchor: number,
  current: number,
  duration: number,
  minimumLength = 0.5,
) {
  const safeAnchor = clampTimelineTime(anchor, duration);
  const safeCurrent = clampTimelineTime(current, duration);
  let start = Math.min(safeAnchor, safeCurrent);
  let end = Math.max(safeAnchor, safeCurrent);
  if (end - start < minimumLength) {
    end = Math.min(duration, start + Math.max(10, minimumLength));
    start = Math.max(0, end - Math.max(10, minimumLength));
  }
  return { start, end };
}
