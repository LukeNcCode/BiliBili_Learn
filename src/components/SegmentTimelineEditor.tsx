import { Plus, Scissors, TriangleAlert } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  clampTimelineTime,
  createTimelineRange,
  moveTimelineRange,
  resizeTimelineRange,
  timelinePercent,
} from "../lib/timeline";
import { formatDuration } from "../lib/format";
import type { Language } from "../types";

export interface TimelineSegmentDraft {
  id: string;
  start: number;
  end: number;
  title: string;
}

interface SegmentTimelineEditorProps {
  language: Language;
  duration: number;
  segments: TimelineSegmentDraft[];
  onChange: (segments: TimelineSegmentDraft[]) => void;
}

interface DragState {
  pointerId: number;
  kind: "create" | "move" | "resize-start" | "resize-end";
  segmentId?: string;
  anchorTime: number;
  original?: TimelineSegmentDraft;
}

function segmentId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function SegmentTimelineEditor({
  language,
  duration,
  segments,
  onChange,
}: SegmentTimelineEditorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(
    null,
  );

  useEffect(() => {
    setDrag(null);
    setPreview(null);
  }, [duration]);

  function timeAt(clientX: number) {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return 0;
    const ratio = (clientX - bounds.left) / bounds.width;
    return clampTimelineTime(ratio * duration, duration);
  }

  function startDrag(
    event: ReactPointerEvent,
    kind: DragState["kind"],
    segment?: TimelineSegmentDraft,
  ) {
    if (duration <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    trackRef.current?.setPointerCapture(event.pointerId);
    const anchorTime = timeAt(event.clientX);
    setDrag({
      pointerId: event.pointerId,
      kind,
      segmentId: segment?.id,
      anchorTime,
      original: segment ? { ...segment } : undefined,
    });
    if (kind === "create") {
      setPreview({ start: anchorTime, end: anchorTime });
    }
  }

  function handlePointerMove(event: ReactPointerEvent) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const time = timeAt(event.clientX);
    if (drag.kind === "create") {
      setPreview(createTimelineRange(drag.anchorTime, time, duration));
      return;
    }
    if (!drag.original || !drag.segmentId) return;
    const original = drag.original;
    const delta = time - drag.anchorTime;
    const next =
      drag.kind === "move"
        ? moveTimelineRange(original, delta, duration)
        : resizeTimelineRange(
            original,
            drag.kind === "resize-start" ? "start" : "end",
            time,
            duration,
          );
    onChange(
      segments.map((segment) =>
        segment.id === drag.segmentId
          ? { ...segment, start: next.start, end: next.end }
          : segment,
      ),
    );
  }

  function finishDrag(event: ReactPointerEvent) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === "create" && preview) {
      onChange([
        ...segments,
        {
          id: segmentId(),
          start: preview.start,
          end: preview.end,
          title:
            language === "zh"
              ? `片段 ${segments.length + 1}`
              : `Segment ${segments.length + 1}`,
        },
      ]);
    }
    setPreview(null);
    setDrag(null);
    trackRef.current?.releasePointerCapture(event.pointerId);
  }

  function addSegment() {
    const previous = [...segments].sort((left, right) => right.end - left.end)[0];
    const candidate = Math.min(duration, previous?.end || 0);
    const start =
      duration - candidate < 1 ? Math.max(0, duration - 30) : candidate;
    const end = Math.min(duration, start + 30);
    onChange([
      ...segments,
      {
        id: segmentId(),
        start,
        end,
        title:
          language === "zh"
            ? `片段 ${segments.length + 1}`
            : `Segment ${segments.length + 1}`,
      },
    ]);
  }

  function updateSegment(
    id: string,
    patch: Partial<TimelineSegmentDraft>,
  ) {
    onChange(
      segments.map((segment) =>
        segment.id === id ? { ...segment, ...patch } : segment,
      ),
    );
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  if (duration <= 0) {
    return (
      <div className="segment-timeline-unavailable">
        <TriangleAlert size={16} />
        <span>
          {language === "zh"
            ? "尚未读取到这个视频的真实时长。请先打开对应视频，再设置片段。"
            : "The real video duration is not available yet. Open this video before editing segments."}
        </span>
      </div>
    );
  }

  return (
    <div className="segment-timeline-editor">
      <div className="segment-timeline-heading">
        <div>
          <strong>{language === "zh" ? "视频时间线" : "Video timeline"}</strong>
          <small>
            {language === "zh"
              ? `总长度 ${formatDuration(duration, language)} · 在轨道上拖动即可创建片段`
              : `${formatDuration(duration, language)} total · Drag on the track to create a segment`}
          </small>
        </div>
        <button type="button" onClick={addSegment}>
          <Plus size={12} />
          {language === "zh" ? "添加片段" : "Add segment"}
        </button>
      </div>

      <div
        ref={trackRef}
        className={
          drag ? "segment-timeline-track dragging" : "segment-timeline-track"
        }
        onPointerDown={(event) => startDrag(event, "create")}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div className="segment-timeline-wave" aria-hidden="true" />
        {segments.map((segment, index) => {
          const start = timelinePercent(segment.start, duration);
          const end = timelinePercent(segment.end, duration);
          return (
            <div
              key={segment.id}
              className="segment-timeline-block"
              style={{
                left: `${start}%`,
                width: `${Math.max(0.4, end - start)}%`,
              }}
              onPointerDown={(event) => startDrag(event, "move", segment)}
              title={`${segment.title}: ${formatDuration(segment.start, language)} - ${formatDuration(segment.end, language)}`}
            >
              <button
                type="button"
                className="segment-timeline-handle start"
                onPointerDown={(event) =>
                  startDrag(event, "resize-start", segment)
                }
                aria-label={
                  language === "zh" ? "调整片段开始时间" : "Resize segment start"
                }
              />
              <span>
                <Scissors size={10} />
                {segment.title || `${language === "zh" ? "片段" : "Segment"} ${index + 1}`}
              </span>
              <button
                type="button"
                className="segment-timeline-handle end"
                onPointerDown={(event) =>
                  startDrag(event, "resize-end", segment)
                }
                aria-label={
                  language === "zh" ? "调整片段结束时间" : "Resize segment end"
                }
              />
            </div>
          );
        })}
        {preview && (
          <div
            className="segment-timeline-preview"
            style={{
              left: `${timelinePercent(preview.start, duration)}%`,
              width: `${Math.max(
                0.4,
                timelinePercent(preview.end, duration) -
                  timelinePercent(preview.start, duration),
              )}%`,
            }}
          />
        )}
      </div>

      <div className="segment-timeline-ruler" aria-hidden="true">
        {ticks.map((ratio) => (
          <span
            key={ratio}
            style={{ left: `${ratio * 100}%` }}
          >
            {formatDuration(duration * ratio, language)}
          </span>
        ))}
      </div>

      <div className="segment-timeline-list">
        {segments.length === 0 ? (
          <button type="button" onClick={addSegment}>
            <Scissors size={14} />
            {language === "zh"
              ? "还没有片段，点击这里或在时间线上拖动"
              : "No segments yet. Click here or drag on the timeline."}
          </button>
        ) : (
          segments.map((segment, index) => (
            <div className="segment-timeline-row" key={segment.id}>
              <span className="segment-timeline-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <input
                value={segment.title}
                onChange={(event) =>
                  updateSegment(segment.id, { title: event.target.value })
                }
                aria-label={
                  language === "zh"
                    ? `片段 ${index + 1} 标题`
                    : `Segment ${index + 1} title`
                }
              />
              <label>
                <span>{language === "zh" ? "开始" : "Start"}</span>
                <input
                  type="number"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={Number(segment.start.toFixed(1))}
                  onChange={(event) => {
                    const next = resizeTimelineRange(
                      segment,
                      "start",
                      Number(event.target.value),
                      duration,
                    );
                    updateSegment(segment.id, next);
                  }}
                />
              </label>
              <label>
                <span>{language === "zh" ? "结束" : "End"}</span>
                <input
                  type="number"
                  min="0"
                  max={duration}
                  step="0.1"
                  value={Number(segment.end.toFixed(1))}
                  onChange={(event) => {
                    const next = resizeTimelineRange(
                      segment,
                      "end",
                      Number(event.target.value),
                      duration,
                    );
                    updateSegment(segment.id, next);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange(segments.filter((item) => item.id !== segment.id))
                }
                aria-label={
                  language === "zh"
                    ? `删除片段 ${index + 1}`
                    : `Delete segment ${index + 1}`
                }
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
