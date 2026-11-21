import {
  Blend,
  Check,
  Eye,
  NotebookPen,
  Pencil,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { Language } from "../types";

interface CourseNotesProps {
  language: Language;
  notesKey: string;
  title: string;
}

interface NotesPanelGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NOTES_GEOMETRY_KEY = "studyflow.courseNotesPanel.geometry";
const NOTES_OPACITY_KEY = "studyflow.courseNotesPanel.opacity";
const NOTES_MIN_WIDTH = 380;
const NOTES_MIN_HEIGHT = 320;
const NOTES_MIN_OPACITY = 30;

function defaultNotesGeometry(): NotesPanelGeometry {
  const width = Math.min(640, Math.max(NOTES_MIN_WIDTH, innerWidth - 32));
  const height = Math.min(560, Math.max(NOTES_MIN_HEIGHT, innerHeight - 110));
  return {
    x: Math.max(16, innerWidth - width - 24),
    y: Math.max(64, innerHeight - height - 24),
    width,
    height,
  };
}

function clampNotesGeometry(
  geometry: NotesPanelGeometry,
): NotesPanelGeometry {
  const width = Math.min(
    Math.max(NOTES_MIN_WIDTH, geometry.width),
    Math.max(NOTES_MIN_WIDTH, innerWidth - 16),
  );
  const height = Math.min(
    Math.max(NOTES_MIN_HEIGHT, geometry.height),
    Math.max(NOTES_MIN_HEIGHT, innerHeight - 16),
  );
  return {
    width,
    height,
    x: Math.min(Math.max(8, geometry.x), Math.max(8, innerWidth - width - 8)),
    y: Math.min(Math.max(8, geometry.y), Math.max(8, innerHeight - height - 8)),
  };
}

function readNotesGeometry() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(NOTES_GEOMETRY_KEY) || "null",
    ) as NotesPanelGeometry | null;
    if (
      stored &&
      [stored.x, stored.y, stored.width, stored.height].every(Number.isFinite)
    ) {
      return clampNotesGeometry(stored);
    }
  } catch {
    // Fall back to a viewport-relative position.
  }
  return defaultNotesGeometry();
}

function readNotesOpacity() {
  try {
    const value = Number(localStorage.getItem(NOTES_OPACITY_KEY));
    if (Number.isFinite(value)) {
      return Math.min(100, Math.max(NOTES_MIN_OPACITY, value));
    }
  } catch {
    // Use full opacity when local preferences are unavailable.
  }
  return 100;
}

function noteStorageKey(notesKey: string) {
  return `studyflow.courseNotes.${notesKey}`;
}

function safeLink(value: string) {
  return /^https?:\/\//i.test(value) ? value : "";
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-inline-${index}`;
    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = link ? safeLink(link[2]) : "";
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault();
              void window.studyflow?.openNoteLink(href);
            }}
          >
            {link?.[1]}
          </a>
        ) : (
          link?.[1] || token
        ),
      );
    }
    cursor = match.index + token.length;
    index += 1;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function isBlockStart(line: string) {
  return (
    /^```/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^---+$/.test(line)
  );
}

function MarkdownPreview({
  source,
  language,
}: {
  source: string;
  language: Language;
}) {
  const blocks = useMemo(() => {
    const lines = source.replace(/\r/g, "").split("\n");
    const output: ReactNode[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (line.startsWith("```")) {
        const code: string[] = [];
        index += 1;
        while (index < lines.length && !lines[index].startsWith("```")) {
          code.push(lines[index]);
          index += 1;
        }
        index += index < lines.length ? 1 : 0;
        output.push(
          <pre key={`code-${index}`}>
            <code>{code.join("\n")}</code>
          </pre>,
        );
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const content = renderInline(heading[2], `heading-${index}`);
        const level = heading[1].length;
        output.push(
          level === 1 ? (
            <h1 key={`heading-${index}`}>{content}</h1>
          ) : level === 2 ? (
            <h2 key={`heading-${index}`}>{content}</h2>
          ) : level === 3 ? (
            <h3 key={`heading-${index}`}>{content}</h3>
          ) : (
            <h4 key={`heading-${index}`}>{content}</h4>
          ),
        );
        index += 1;
        continue;
      }

      if (/^---+$/.test(line)) {
        output.push(<hr key={`rule-${index}`} />);
        index += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quote: string[] = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quote.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        output.push(
          <blockquote key={`quote-${index}`}>
            {renderInline(quote.join(" "), `quote-${index}`)}
          </blockquote>,
        );
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const items: string[] = [];
        while (
          index < lines.length &&
          /^\s*[-*+]\s+/.test(lines[index])
        ) {
          items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
          index += 1;
        }
        output.push(
          <ul key={`list-${index}`}>
            {items.map((item, itemIndex) => {
              const task = item.match(/^\[([ xX])\]\s*(.*)$/);
              return (
                <li key={`list-${index}-${itemIndex}`}>
                  {task && (
                    <input
                      type="checkbox"
                      checked={task[1].toLowerCase() === "x"}
                      readOnly
                    />
                  )}
                  {renderInline(
                    task ? task[2] : item,
                    `list-${index}-${itemIndex}`,
                  )}
                </li>
              );
            })}
          </ul>,
        );
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items: string[] = [];
        while (
          index < lines.length &&
          /^\s*\d+\.\s+/.test(lines[index])
        ) {
          items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
          index += 1;
        }
        output.push(
          <ol key={`ordered-${index}`}>
            {items.map((item, itemIndex) => (
              <li key={`ordered-${index}-${itemIndex}`}>
                {renderInline(item, `ordered-${index}-${itemIndex}`)}
              </li>
            ))}
          </ol>,
        );
        continue;
      }

      const paragraph: string[] = [line.trim()];
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() &&
        !isBlockStart(lines[index])
      ) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      output.push(
        <p key={`paragraph-${index}`}>
          {renderInline(paragraph.join(" "), `paragraph-${index}`)}
        </p>,
      );
    }

    return output;
  }, [source]);

  if (!source.trim()) {
    return (
      <div className="course-notes-preview-empty">
        <NotebookPen size={25} />
        <span>
          {language === "zh"
            ? "还没有笔记。切换到编辑模式开始记录。"
            : "No notes yet. Switch to edit mode to start writing."}
        </span>
      </div>
    );
  }

  return <div className="course-notes-markdown">{blocks}</div>;
}

export function CourseNotes({
  language,
  notesKey,
  title,
}: CourseNotesProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [draft, setDraft] = useState("");
  const [opacity, setOpacity] = useState(readNotesOpacity);
  const [geometry, setGeometry] =
    useState<NotesPanelGeometry>(defaultNotesGeometry);
  const geometryRef = useRef(geometry);
  const draftRef = useRef(draft);
  const loadedNotesKey = useRef("");
  const noteLoaded = useRef(false);
  const noteSaveTimer = useRef<number | null>(null);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const resizeState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  function persistNote(key: string, value: string) {
    if (!key) return;
    const legacyKey = noteStorageKey(key);
    if (window.studyflow) {
      void window.studyflow
        .savePersistentItem(`courseNotes.${key}`, value)
        .catch(() => {
          try {
            localStorage.setItem(legacyKey, value);
          } catch {}
        });
      return;
    }
    try {
      localStorage.setItem(legacyKey, value);
    } catch {
      // Notes remain available for the current session.
    }
  }

  function flushDraft() {
    if (noteSaveTimer.current) {
      window.clearTimeout(noteSaveTimer.current);
      noteSaveTimer.current = null;
    }
    if (loadedNotesKey.current && noteLoaded.current) {
      persistNote(loadedNotesKey.current, draftRef.current);
    }
  }

  useEffect(() => {
    let active = true;
    if (
      loadedNotesKey.current &&
      loadedNotesKey.current !== notesKey &&
      noteLoaded.current
    ) {
      persistNote(loadedNotesKey.current, draftRef.current);
    }
    loadedNotesKey.current = notesKey;
    noteLoaded.current = false;
    const legacyValue = (() => {
      try {
        return localStorage.getItem(noteStorageKey(notesKey)) || "";
      } catch {
        return "";
      }
    })();
    if (!window.studyflow) {
      draftRef.current = legacyValue;
      setDraft(legacyValue);
      noteLoaded.current = true;
      return;
    }
    void window.studyflow
      .loadPersistentItem(`courseNotes.${notesKey}`)
      .then((stored) => {
        if (!active) return;
        const value =
          typeof stored === "string" ? stored : legacyValue;
        draftRef.current = value;
        setDraft(value);
        noteLoaded.current = true;
      })
      .catch(() => {
        if (!active) return;
        draftRef.current = legacyValue;
        setDraft(legacyValue);
        noteLoaded.current = true;
      });
    return () => {
      active = false;
    };
  }, [notesKey]);

  useEffect(
    () => () => {
      if (noteSaveTimer.current) {
        window.clearTimeout(noteSaveTimer.current);
        noteSaveTimer.current = null;
      }
      if (loadedNotesKey.current && noteLoaded.current) {
        persistNote(loadedNotesKey.current, draftRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const next = readNotesGeometry();
    geometryRef.current = next;
    setGeometry(next);
    const clamp = () =>
      setGeometry((current) => {
        const clamped = clampNotesGeometry(current);
        geometryRef.current = clamped;
        return clamped;
      });
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [open]);

  function storeGeometry(value: NotesPanelGeometry) {
    try {
      localStorage.setItem(NOTES_GEOMETRY_KEY, JSON.stringify(value));
    } catch {
      // Geometry persistence is optional.
    }
  }

  function startMove(event: ReactPointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button, input, textarea")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: geometry.x,
      originY: geometry.y,
    };
  }

  function movePanel(event: ReactPointerEvent<HTMLElement>) {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    setGeometry((current) => {
      const next = clampNotesGeometry({
        ...current,
        x: state.originX + event.clientX - state.startX,
        y: state.originY + event.clientY - state.startY,
      });
      geometryRef.current = next;
      return next;
    });
  }

  function finishMove(event: ReactPointerEvent<HTMLElement>) {
    if (dragState.current?.pointerId !== event.pointerId) return;
    dragState.current = null;
    storeGeometry(geometryRef.current);
  }

  function startResize(event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: geometry.width,
      startHeight: geometry.height,
    };
  }

  function resizePanel(event: ReactPointerEvent<HTMLElement>) {
    const state = resizeState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    setGeometry((current) => {
      const next = clampNotesGeometry({
        ...current,
        width: state.startWidth + event.clientX - state.startX,
        height: state.startHeight + event.clientY - state.startY,
      });
      geometryRef.current = next;
      return next;
    });
  }

  function finishResize(event: ReactPointerEvent<HTMLElement>) {
    if (resizeState.current?.pointerId !== event.pointerId) return;
    resizeState.current = null;
    storeGeometry(geometryRef.current);
  }

  function updateDraft(value: string) {
    draftRef.current = value;
    setDraft(value);
    if (noteSaveTimer.current) window.clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = window.setTimeout(() => {
      noteSaveTimer.current = null;
      persistNote(notesKey, value);
    }, 450);
  }

  function updateOpacity(value: number) {
    const next = Math.min(100, Math.max(NOTES_MIN_OPACITY, value));
    setOpacity(next);
    try {
      localStorage.setItem(NOTES_OPACITY_KEY, String(next));
    } catch {
      // Opacity remains available for the current session.
    }
  }

  return (
    <div className="course-notes-floating">
      {open && (
        <section
          className="course-notes-panel"
          aria-label={language === "zh" ? "课程笔记" : "Course notes"}
          style={{
            left: geometry.x,
            top: geometry.y,
            width: geometry.width,
            height: geometry.height,
            "--notes-surface-opacity": `${opacity}%`,
          } as CSSProperties}
        >
          <header
            className="course-notes-head"
            onPointerDown={startMove}
            onPointerMove={movePanel}
            onPointerUp={finishMove}
            onPointerCancel={finishMove}
          >
            <div>
              <span>
                {language === "zh" ? "COURSE NOTES" : "COURSE NOTES"}
              </span>
              <strong title={title}>{title}</strong>
            </div>
            <div>
              <div className="course-notes-tabs">
                <button
                  type="button"
                  className={mode === "edit" ? "active" : ""}
                  onClick={() => setMode("edit")}
                >
                  <Pencil size={13} />
                  {language === "zh" ? "编辑" : "Edit"}
                </button>
                <button
                  type="button"
                  className={mode === "preview" ? "active" : ""}
                  onClick={() => setMode("preview")}
                >
                  <Eye size={13} />
                  {language === "zh" ? "预览" : "Preview"}
                </button>
              </div>
              <button
                type="button"
                className="course-notes-close"
                onClick={() => setOpen(false)}
                aria-label={
                  language === "zh" ? "关闭课程笔记" : "Close course notes"
                }
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="course-notes-body">
            {mode === "edit" ? (
              <textarea
                value={draft}
                onChange={(event) => updateDraft(event.target.value)}
                onBlur={flushDraft}
                spellCheck={false}
                placeholder={
                  language === "zh"
                    ? "# 章节标题\n\n记录重点、公式、疑问或待复习内容。\n\n- **重点**：\n- `关键词`\n- [参考链接](https://example.com)"
                    : "# Section title\n\nWrite key ideas, questions, formulas, or review items.\n\n- **Important**\n- `keyword`\n- [Reference](https://example.com)"
                }
              />
            ) : (
              <MarkdownPreview source={draft} language={language} />
            )}
          </div>

          <footer className="course-notes-foot">
            <span>
              <Check size={12} />
              {language === "zh" ? "自动保存到本机" : "Saved locally"}
            </span>
            <label
              className="course-notes-opacity"
              title={language === "zh" ? "调整笔记透明度" : "Note opacity"}
            >
              <Blend size={12} />
              <input
                type="range"
                min={NOTES_MIN_OPACITY}
                max={100}
                step={5}
                value={opacity}
                onChange={(event) => updateOpacity(Number(event.target.value))}
                aria-label={
                  language === "zh" ? "课程笔记透明度" : "Course notes opacity"
                }
                style={
                  {
                    "--notes-progress": `${
                      ((opacity - NOTES_MIN_OPACITY) /
                        (100 - NOTES_MIN_OPACITY)) *
                      100
                    }%`,
                  } as CSSProperties
                }
              />
              <output>{opacity}%</output>
            </label>
            <span>{language === "zh" ? "支持 Markdown" : "Markdown"}</span>
          </footer>
          <span
            className="course-notes-resize-handle"
            onPointerDown={startResize}
            onPointerMove={resizePanel}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
            aria-hidden="true"
          />
        </section>
      )}

      {!open && (
        <button
          type="button"
          className="course-notes-fab"
          onClick={() => setOpen(true)}
          aria-expanded={false}
        >
          <NotebookPen size={17} />
          <span>{language === "zh" ? "课程笔记" : "Notes"}</span>
        </button>
      )}
    </div>
  );
}
