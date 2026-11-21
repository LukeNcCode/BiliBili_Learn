import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  ListVideo,
  Pencil,
  Scissors,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  groupLessonsByCollection,
  lessonTitleWithinCollection,
} from "../lib/creator";
import { formatDuration } from "../lib/format";
import type { CreatorProject, Language, LearningLesson } from "../types";
import { CoverArt } from "./CoverArt";
import {
  SegmentTimelineEditor,
  type TimelineSegmentDraft,
} from "./SegmentTimelineEditor";

interface CreatorProjectLibraryProps {
  language: Language;
  project: CreatorProject;
  lessonCount: number;
  plannedDuration: number;
  onRemoveCourse: (courseId: string) => void;
  onRemoveSection: (courseId: string, sectionId: string) => void;
  onRemoveCollection: (lessonIds: string[]) => void;
  onSaveLesson: (
    lessonId: string,
    inclusion: "full" | "segments",
    segments: TimelineSegmentDraft[],
  ) => void;
  renderLessonMonitor: (lesson: LearningLesson) => ReactNode;
  onFullscreenChange: (fullscreen: boolean) => void;
}

export function CreatorProjectLibrary({
  language,
  project,
  lessonCount,
  plannedDuration,
  onRemoveCourse,
  onRemoveSection,
  onRemoveCollection,
  onSaveLesson,
  renderLessonMonitor,
  onFullscreenChange,
}: CreatorProjectLibraryProps) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(
    new Set(),
  );
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingInclusion, setEditingInclusion] = useState<
    "full" | "segments"
  >("full");
  const [editingSegments, setEditingSegments] = useState<
    TimelineSegmentDraft[]
  >([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [openFolderKeys, setOpenFolderKeys] = useState<Set<string>>(new Set());

  const fullscreenGroups = useMemo(
    () =>
      project.courses.flatMap((course) =>
        course.sections.flatMap((section) =>
          groupLessonsByCollection(section.lessons).map((group) => ({
            course,
            section,
            group,
            isCollection:
              group.key.startsWith("collection:") || group.lessons.length > 1,
          })),
        ),
      ),
    [project],
  );
  const selectedLesson = useMemo(() => {
    if (!selectedLessonId) return null;
    return (
      project.courses
        .flatMap((course) =>
          course.sections.flatMap((section) => section.lessons),
        )
        .find((lesson) => lesson.id === selectedLessonId) || null
    );
  }, [project, selectedLessonId]);

  function beginLessonEdit(lesson: LearningLesson) {
    setEditingLessonId(lesson.id);
    setEditingInclusion(lesson.inclusion);
    setEditingSegments(lesson.segments.map((segment) => ({ ...segment })));
  }

  function selectLessonForMonitor(lesson: LearningLesson) {
    setSelectedLessonId(lesson.id);
    beginLessonEdit(lesson);
  }

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFullscreen(false);
      setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, fullscreen]);

  useEffect(() => {
    onFullscreenChange(open && fullscreen);
    return () => onFullscreenChange(false);
  }, [open, fullscreen, onFullscreenChange]);

  return (
    <div className="creator-library-floating">
      {open && (
        <aside
          className={
            fullscreen
              ? "creator-library-panel fullscreen"
              : "creator-library-panel"
          }
          aria-label={language === "zh" ? "清单内容" : "List contents"}
          role={fullscreen ? "dialog" : undefined}
          aria-modal={fullscreen ? "true" : undefined}
        >
          <header className="creator-library-panel-head">
            <div>
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                LEARNING LIST
              </span>
              <h2>{language === "zh" ? "清单内容" : "List contents"}</h2>
            </div>
            <div className="creator-library-panel-actions">
              <button
                type="button"
                onClick={() => {
                  setFullscreen(false);
                  setOpen(false);
                }}
                aria-label={
                  language === "zh" ? "关闭清单内容" : "Close list contents"
                }
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="creator-library-summary">
            <span>
              <strong>{lessonCount}</strong>
              {language === "zh" ? "个视频" : "videos"}
            </span>
            <span>
              <strong>{formatDuration(plannedDuration, language)}</strong>
              {language === "zh" ? "计划时长" : "planned"}
            </span>
          </div>

          <div className="creator-library-panel-body">
            {project.courses.length === 0 ? (
              <div className="creator-library-empty">
                {language === "zh"
                  ? "清单中还没有课程。请先在制作页面添加课程。"
                  : "There are no courses in this list yet."}
              </div>
            ) : fullscreen ? (
              <div className="creator-full-editor">
                <aside className="creator-media-bin">
                  <div className="creator-media-bin-head">
                    <strong>
                      {language === "zh" ? "清单内容" : "List contents"}
                    </strong>
                    <small>
                      {language === "zh"
                        ? "双击视频进入监视器编辑"
                        : "Double-click a video to open it in the monitor"}
                    </small>
                  </div>
                  <div className="creator-media-assets">
                    {fullscreenGroups.map(
                      ({ course, section, group, isCollection }) => {
                        const folderOpen = openFolderKeys.has(group.key);
                        return (
                          <div className="creator-media-asset" key={group.key}>
                            {isCollection ? (
                              <>
                                <button
                                  type="button"
                                  className="creator-folder-card"
                                  onClick={() =>
                                    setOpenFolderKeys((current) => {
                                      const next = new Set(current);
                                      if (next.has(group.key)) {
                                        next.delete(group.key);
                                      } else {
                                        next.add(group.key);
                                      }
                                      return next;
                                    })
                                  }
                                  aria-expanded={folderOpen}
                                >
                                  <span className="creator-folder-cover">
                                    <CoverArt
                                      cover={group.cover}
                                      title={group.title}
                                      subject="general"
                                    />
                                    <span className="creator-folder-icon">
                                      {folderOpen ? (
                                        <FolderOpen size={14} />
                                      ) : (
                                        <Folder size={14} />
                                      )}
                                    </span>
                                  </span>
                                  <span className="creator-folder-copy">
                                    <strong title={group.title}>
                                      {group.title}
                                    </strong>
                                    <small title={`${course.title} / ${section.title}`}>
                                      {course.title} / {section.title} ·{" "}
                                      {group.lessons.length}{" "}
                                      {language === "zh"
                                        ? "个视频"
                                        : "videos"}
                                    </small>
                                  </span>
                                  {folderOpen ? (
                                    <ChevronDown size={14} />
                                  ) : (
                                    <ChevronRight size={14} />
                                  )}
                                </button>
                                {folderOpen && (
                                  <div className="creator-folder-videos">
                                    {group.lessons.map((lesson) => (
                                      <button
                                        type="button"
                                        className={
                                          selectedLessonId === lesson.id
                                            ? "creator-bin-video active"
                                            : "creator-bin-video"
                                        }
                                        key={lesson.id}
                                        onDoubleClick={() =>
                                          selectLessonForMonitor(lesson)
                                        }
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            selectLessonForMonitor(lesson);
                                          }
                                        }}
                                        title={
                                          language === "zh"
                                            ? "双击在监视器中打开"
                                            : "Double-click to open in the monitor"
                                        }
                                      >
                                        <span className="creator-bin-cover">
                                          <CoverArt
                                            cover={lesson.cover || group.cover}
                                            title={lesson.title}
                                            subject="general"
                                          />
                                        </span>
                                        <span>
                                          <strong>
                                            {lessonTitleWithinCollection(
                                              lesson,
                                              group.title,
                                            )}
                                          </strong>
                                          <small>
                                            {formatDuration(
                                              lesson.duration,
                                              language,
                                            )}
                                          </small>
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              group.lessons.map((lesson) => (
                                <button
                                  type="button"
                                  className={
                                    selectedLessonId === lesson.id
                                      ? "creator-bin-video single active"
                                      : "creator-bin-video single"
                                  }
                                  key={lesson.id}
                                  onDoubleClick={() =>
                                    selectLessonForMonitor(lesson)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      selectLessonForMonitor(lesson);
                                    }
                                  }}
                                  title={
                                    language === "zh"
                                      ? "双击在监视器中打开"
                                      : "Double-click to open in the monitor"
                                  }
                                >
                                  <span className="creator-bin-cover">
                                    <CoverArt
                                      cover={lesson.cover}
                                      title={lesson.title}
                                      subject="general"
                                    />
                                  </span>
                                  <span>
                                    <strong>{lesson.title}</strong>
                                    <small>
                                      {formatDuration(lesson.duration, language)}
                                    </small>
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                </aside>

                <main className="creator-edit-stage">
                  <section className="creator-monitor-panel">
                    <div className="creator-stage-heading">
                      <div>
                        <span>
                          {language === "zh" ? "视频监视器" : "Video monitor"}
                        </span>
                        <strong>
                          {selectedLesson?.title ||
                            (language === "zh"
                              ? "双击左侧视频开始编辑"
                              : "Double-click a video on the left")}
                        </strong>
                      </div>
                    </div>
                    <div className="creator-monitor-frame">
                      {selectedLesson ? (
                        renderLessonMonitor(selectedLesson)
                      ) : (
                        <div className="creator-monitor-empty">
                          <Video size={28} />
                          <span>
                            {language === "zh"
                              ? "选择视频后在这里预览"
                              : "Select a video to preview it here"}
                          </span>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="creator-timeline-panel">
                    <div className="creator-stage-heading">
                      <div>
                        <span>
                          {language === "zh" ? "视频轨道" : "Video track"}
                        </span>
                        <strong>
                          {language === "zh"
                            ? "设置整段播放或保留指定片段"
                            : "Use the full video or keep selected segments"}
                        </strong>
                      </div>
                      {selectedLesson && (
                        <button
                          type="button"
                          className="creator-monitor-delete"
                          onClick={() => {
                            onRemoveCollection([selectedLesson.id]);
                            setSelectedLessonId(null);
                          }}
                        >
                          <Trash2 size={12} />
                          {language === "zh" ? "移出清单" : "Remove"}
                        </button>
                      )}
                    </div>

                    {selectedLesson ? (
                      <>
                        <div className="creator-inline-mode">
                          <button
                            type="button"
                            className={
                              editingInclusion === "full" ? "active" : ""
                            }
                            onClick={() => {
                              setEditingInclusion("full");
                              setEditingSegments([]);
                            }}
                          >
                            <Video size={12} />
                            {language === "zh" ? "整段播放" : "Full video"}
                          </button>
                          <button
                            type="button"
                            className={
                              editingInclusion === "segments" ? "active" : ""
                            }
                            onClick={() => setEditingInclusion("segments")}
                          >
                            <Scissors size={12} />
                            {language === "zh" ? "片段播放" : "Segments"}
                          </button>
                        </div>
                        {editingInclusion === "segments" ? (
                          <SegmentTimelineEditor
                            language={language}
                            duration={selectedLesson.duration}
                            segments={editingSegments}
                            onChange={setEditingSegments}
                          />
                        ) : (
                          <div className="creator-track-full">
                            <Video size={16} />
                            <span>
                              {language === "zh"
                                ? "当前视频将完整播放"
                                : "The complete video will play"}
                            </span>
                          </div>
                        )}
                        <div className="creator-inline-actions">
                          <button
                            type="button"
                            className="accent"
                            disabled={
                              editingInclusion === "segments" &&
                              editingSegments.length === 0
                            }
                            onClick={() =>
                              onSaveLesson(
                                selectedLesson.id,
                                editingInclusion,
                                editingSegments,
                              )
                            }
                          >
                            <Check size={12} />
                            {language === "zh" ? "保存轨道" : "Save track"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="creator-monitor-empty track-empty">
                        <Scissors size={23} />
                        <span>
                          {language === "zh"
                            ? "双击视频后，在此划分片段"
                            : "Double-click a video, then edit its segments here"}
                        </span>
                      </div>
                    )}
                  </section>
                </main>
              </div>
            ) : (
              project.courses.map((course) => {
                const courseLessonCount = course.sections.reduce(
                  (total, section) => total + section.lessons.length,
                  0,
                );
                const courseExpanded = expandedCourseIds.has(course.id);
                return (
                  <section className="creator-course-group" key={course.id}>
                    <div className="creator-course-heading-row">
                      <button
                        type="button"
                        className="creator-course-toggle"
                        aria-expanded={courseExpanded}
                        onClick={() =>
                          setExpandedCourseIds((current) => {
                            const next = new Set(current);
                            if (next.has(course.id)) next.delete(course.id);
                            else next.add(course.id);
                            return next;
                          })
                        }
                      >
                        {courseExpanded ? (
                          <ChevronDown size={15} />
                        ) : (
                          <ChevronRight size={15} />
                        )}
                        <span>
                          <strong title={course.title}>{course.title}</strong>
                          <small>
                            {course.sections.length}{" "}
                            {language === "zh" ? "个章节" : "sections"} ·{" "}
                            {courseLessonCount}{" "}
                            {language === "zh" ? "个视频" : "videos"}
                          </small>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="creator-library-level-delete"
                        onClick={() => onRemoveCourse(course.id)}
                        title={
                          language === "zh"
                            ? `删除课程：${course.title}`
                            : `Delete course: ${course.title}`
                        }
                        aria-label={
                          language === "zh"
                            ? `删除课程：${course.title}`
                            : `Delete course: ${course.title}`
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {courseExpanded && (
                      <div className="creator-course-body">
                        {course.sections.map((section) => {
                          const sectionExpanded = expandedSectionIds.has(
                            section.id,
                          );
                          const collectionGroups = groupLessonsByCollection(
                            section.lessons,
                          );
                          return (
                            <section
                              className="creator-section-group"
                              key={section.id}
                            >
                              <div className="creator-section-heading-row">
                                <button
                                  type="button"
                                  className="creator-section-toggle"
                                  aria-expanded={sectionExpanded}
                                  onClick={() =>
                                    setExpandedSectionIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(section.id))
                                        next.delete(section.id);
                                      else next.add(section.id);
                                      return next;
                                    })
                                  }
                                >
                                  {sectionExpanded ? (
                                    <ChevronDown size={13} />
                                  ) : (
                                    <ChevronRight size={13} />
                                  )}
                                  <strong title={section.title}>
                                    {section.title}
                                  </strong>
                                  <small>
                                    {section.lessons.length}{" "}
                                    {language === "zh" ? "个视频" : "videos"}
                                  </small>
                                </button>
                                <button
                                  type="button"
                                  className="creator-library-level-delete"
                                  onClick={() =>
                                    onRemoveSection(course.id, section.id)
                                  }
                                  title={
                                    language === "zh"
                                      ? `删除章节：${section.title}`
                                      : `Delete section: ${section.title}`
                                  }
                                  aria-label={
                                    language === "zh"
                                      ? `删除章节：${section.title}`
                                      : `Delete section: ${section.title}`
                                  }
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              {sectionExpanded && (
                                <div className="creator-collection-grid">
                                  {collectionGroups.length === 0 ? (
                                    <span className="creator-library-empty">
                                      {language === "zh"
                                        ? "这个章节还没有视频"
                                        : "No videos in this section"}
                                    </span>
                                  ) : (
                                    collectionGroups.map((group) => {
                                      const isCollection =
                                        group.key.startsWith("collection:") ||
                                        group.lessons.length > 1;
                                      return (
                                      <article
                                        className={
                                          isCollection
                                            ? "creator-collection-group collection"
                                            : "creator-collection-group single-video"
                                        }
                                        key={group.key}
                                      >
                                        <div className="creator-collection-cover">
                                          <CoverArt
                                            cover={group.cover}
                                            title={group.title}
                                            subject="general"
                                          />
                                          {isCollection && (
                                            <span className="creator-collection-kind">
                                              <Folder size={11} />
                                              {language === "zh"
                                                ? "合集"
                                                : "Folder"}
                                            </span>
                                          )}
                                          <span>
                                            {group.lessons.length}{" "}
                                            {language === "zh"
                                              ? "个视频"
                                              : "videos"}
                                          </span>
                                          <button
                                            type="button"
                                            className="creator-collection-remove"
                                            onClick={() =>
                                              onRemoveCollection(
                                                group.lessons.map(
                                                  (lesson) => lesson.id,
                                                ),
                                              )
                                            }
                                            title={
                                              language === "zh"
                                                ? "删除这个合集"
                                                : "Delete this collection"
                                            }
                                            aria-label={
                                              language === "zh"
                                                ? "删除这个合集"
                                                : "Delete this collection"
                                            }
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                        <div className="creator-collection-titles">
                                          {group.lessons.map((lesson) => {
                                            const editing =
                                              editingLessonId === lesson.id;
                                            return (
                                              <div
                                                className="creator-library-lesson"
                                                key={lesson.id}
                                              >
                                                <div className="creator-collection-title-row">
                                                  <span title={lesson.title}>
                                                    {lessonTitleWithinCollection(
                                                      lesson,
                                                      group.title,
                                                    )}
                                                  </span>
                                                  <div className="creator-library-lesson-actions">
                                                    <button
                                                      type="button"
                                                      className={
                                                        editing ? "active" : ""
                                                      }
                                                      onClick={() =>
                                                        editing
                                                          ? setEditingLessonId(
                                                              null,
                                                            )
                                                          : beginLessonEdit(
                                                              lesson,
                                                            )
                                                      }
                                                      title={
                                                        language === "zh"
                                                          ? `编辑播放范围：${lesson.title}`
                                                          : `Edit playback range: ${lesson.title}`
                                                      }
                                                      aria-label={
                                                        language === "zh"
                                                          ? `编辑播放范围：${lesson.title}`
                                                          : `Edit playback range: ${lesson.title}`
                                                      }
                                                    >
                                                      <Pencil size={12} />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        onRemoveCollection([
                                                          lesson.id,
                                                        ])
                                                      }
                                                      title={
                                                        language === "zh"
                                                          ? `从清单移除：${lesson.title}`
                                                          : `Remove from list: ${lesson.title}`
                                                      }
                                                      aria-label={
                                                        language === "zh"
                                                          ? `从清单移除：${lesson.title}`
                                                          : `Remove from list: ${lesson.title}`
                                                      }
                                                    >
                                                      <Trash2 size={12} />
                                                    </button>
                                                  </div>
                                                </div>

                                                {editing && (
                                                  <div className="creator-library-lesson-editor">
                                                    <div className="creator-inline-mode">
                                                      <button
                                                        type="button"
                                                        className={
                                                          editingInclusion ===
                                                          "full"
                                                            ? "active"
                                                            : ""
                                                        }
                                                        onClick={() => {
                                                          setEditingInclusion(
                                                            "full",
                                                          );
                                                          setEditingSegments(
                                                            [],
                                                          );
                                                        }}
                                                      >
                                                        <Video size={12} />
                                                        {language === "zh"
                                                          ? "播放整段"
                                                          : "Full"}
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className={
                                                          editingInclusion ===
                                                          "segments"
                                                            ? "active"
                                                            : ""
                                                        }
                                                        onClick={() =>
                                                          setEditingInclusion(
                                                            "segments",
                                                          )
                                                        }
                                                      >
                                                        <Scissors size={12} />
                                                        {language === "zh"
                                                          ? "指定片段"
                                                          : "Segments"}
                                                      </button>
                                                    </div>

                                                    {editingInclusion ===
                                                      "segments" && (
                                                      <SegmentTimelineEditor
                                                        language={language}
                                                        duration={lesson.duration}
                                                        segments={
                                                          editingSegments
                                                        }
                                                        onChange={
                                                          setEditingSegments
                                                        }
                                                      />
                                                    )}

                                                    <div className="creator-inline-actions">
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setEditingLessonId(
                                                            null,
                                                          )
                                                        }
                                                      >
                                                        {language === "zh"
                                                          ? "取消"
                                                          : "Cancel"}
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className="accent"
                                                        disabled={
                                                          editingInclusion ===
                                                            "segments" &&
                                                          editingSegments.length ===
                                                            0
                                                        }
                                                        onClick={() => {
                                                          onSaveLesson(
                                                            lesson.id,
                                                            editingInclusion,
                                                            editingSegments,
                                                          );
                                                          setEditingLessonId(
                                                            null,
                                                          );
                                                        }}
                                                      >
                                                        <Check size={12} />
                                                        {language === "zh"
                                                          ? "保存"
                                                          : "Save"}
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </article>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
        </aside>
      )}

      <button
        type="button"
        className={open ? "creator-library-fab active" : "creator-library-fab"}
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setFullscreen(false);
            setOpen(false);
            return;
          }
          setExpandedCourseIds(new Set());
          setExpandedSectionIds(new Set());
          setFullscreen(true);
          setOpen(true);
        }}
      >
        <ListVideo size={17} />
        <span>{language === "zh" ? "清单内容" : "List contents"}</span>
        <strong>{lessonCount}</strong>
      </button>
    </div>
  );
}
