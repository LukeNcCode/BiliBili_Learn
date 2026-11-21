import {
  FormEvent,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileJson,
  FolderOpen,
  Github,
  Library,
  LoaderCircle,
  Play,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { formatDuration } from "../lib/format";
import {
  countLearningListLessons,
  learningListDuration,
  sumLessonDurations,
} from "../lib/learningListMetrics";
import { searchLearningLists } from "../lib/learningListSearch";
import type {
  ImportedLearningList,
  Language,
  LearningCourse,
  LearningLesson,
  LearningSection,
} from "../types";

interface LearningListsPageProps {
  language: Language;
  lists: ImportedLearningList[];
  importing: boolean;
  error: string;
  onImport: (url: string) => void;
  onImportLocal: (file: File) => void;
  onRefresh: (list: ImportedLearningList) => void;
  onRemove: (id: string) => void;
  onOpenCreator: () => void;
  onOpenLesson: (
    list: ImportedLearningList,
    course: LearningCourse,
    section: LearningSection,
    lesson: LearningLesson,
  ) => void;
}

export function LearningListsPage({
  language,
  lists,
  importing,
  error,
  onImport,
  onImportLocal,
  onRefresh,
  onRemove,
  onOpenCreator,
  onOpenLesson,
}: LearningListsPageProps) {
  const [url, setUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const localFileInput = useRef<HTMLInputElement>(null);
  const [expandedListIds, setExpandedListIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");

  const totalCourses = useMemo(
    () => lists.reduce((total, list) => total + list.courses.length, 0),
    [lists],
  );
  const totalLessons = useMemo(
    () =>
      lists.reduce(
        (total, list) => total + countLearningListLessons(list),
        0,
      ),
    [lists],
  );
  const searchActive = searchQuery.trim().length > 0;
  const visibleLists = useMemo(
    () => searchLearningLists(lists, searchQuery),
    [lists, searchQuery],
  );
  const filteredLessonCount = useMemo(
    () =>
      visibleLists.reduce(
        (total, result) =>
          total +
          result.courses.reduce(
            (courseTotal, entry) =>
              courseTotal +
              entry.sections.reduce(
                (sectionTotal, section) =>
                  sectionTotal + section.lessons.length,
                0,
              ),
            0,
          ),
        0,
      ),
    [visibleLists],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim() || importing) return;
    onImport(url.trim());
  }

  function chooseLocalFile() {
    if (!importing) localFileInput.current?.click();
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importing) setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragActive(false);
    if (importing) return;
    const file = Array.from(event.dataTransfer.files).find(
      (item) => item.type === "application/json" || /\.json$/i.test(item.name),
    );
    if (file) onImportLocal(file);
  }

  function toggleSet(
    setter: Dispatch<SetStateAction<Set<string>>>,
    id: string,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="page learning-lists-page">
      <div className="page-heading learning-list-heading">
        <div className="learning-list-heading-row">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              LEARNING REPOSITORIES / 03
            </div>
            <h1>{language === "zh" ? "学习清单" : "Learning lists"}</h1>
            <p>
              {language === "zh"
                ? "从 GitHub 仓库或本机 JSON 文件加载按学习目的整理的课程与章节。"
                : "Load course and section collections from GitHub or a local JSON file."}
            </p>
          </div>
          <button
            type="button"
            className="creator-mode-button"
            onClick={onOpenCreator}
          >
            <PenLine size={16} />
            {language === "zh" ? "进入清单制作模式" : "Open creator mode"}
          </button>
        </div>
      </div>

      <div className="learning-list-summary">
        <div>
          <Library size={20} />
          <span>
            <strong>{lists.length}</strong>
            {language === "zh" ? "份清单" : "lists"}
          </span>
        </div>
        <div>
          <BookOpen size={20} />
          <span>
            <strong>{totalCourses}</strong>
            {language === "zh" ? "门课程" : "courses"}
          </span>
        </div>
        <div>
          <Play size={20} />
          <span>
            <strong>{totalLessons}</strong>
            {language === "zh" ? "个课程视频" : "lessons"}
          </span>
        </div>
      </div>

      <form
        className={
          dragActive
            ? "repository-import-form drag-active"
            : "repository-import-form"
        }
        onSubmit={submit}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={localFileInput}
          className="hidden-file-input"
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportLocal(file);
            event.currentTarget.value = "";
          }}
        />
        <div className="repository-input-wrap">
          <Github size={20} />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/owner/repository"
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          className="local-list-button"
          onClick={chooseLocalFile}
          disabled={importing}
        >
          <FolderOpen size={17} />
          {language === "zh" ? "加载本地清单" : "Load local JSON"}
        </button>
        <button
          type="submit"
          className="primary-button repository-import-button"
          disabled={importing}
        >
          {importing ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Plus size={17} />
          )}
          {importing
            ? language === "zh"
              ? "正在导入"
              : "Importing"
            : language === "zh"
              ? "添加仓库"
              : "Add repository"}
        </button>
      </form>

      <div className="repository-help">
        {language === "zh"
          ? "支持仓库根链接、目录链接、JSON 文件链接，也可选择或拖入本地 JSON。清单结构与片段规则保存在本机，重启后可离线浏览；视频播放仍需要 B 站视频流可用。"
          : "Repository, directory and JSON links are supported. You can also choose or drop a local JSON file. List structure and segment rules stay on this device after restart; video playback still requires Bilibili streams to be reachable."}
      </div>

      {error && <div className="repository-error">{error}</div>}

      {lists.length > 0 && (
        <div className="learning-list-search">
          <Search size={18} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchQuery("");
            }}
            placeholder={
              language === "zh"
                ? "搜索清单、课程、章节、视频标题或 BVID"
                : "Search lists, courses, sections, video titles or BVIDs"
            }
            spellCheck={false}
          />
          {searchActive && (
            <span>
              {visibleLists.length}{" "}
              {language === "zh" ? "份清单" : "lists"} ·{" "}
              {filteredLessonCount}{" "}
              {language === "zh" ? "个视频" : "videos"}
            </span>
          )}
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              title={language === "zh" ? "清空搜索" : "Clear search"}
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {lists.length === 0 ? (
        <div className="empty-state repository-empty">
          <div className="empty-icon">
            <FileJson size={29} />
          </div>
          <h2>
            {language === "zh" ? "还没有加载学习清单" : "No learning lists loaded"}
          </h2>
          <p>
            {language === "zh"
              ? "添加 GitHub 仓库，或加载本机 JSON 清单，课程和章节会显示在这里。"
              : "Add a GitHub repository or load a local JSON file to see its courses and sections here."}
          </p>
        </div>
      ) : searchActive && visibleLists.length === 0 ? (
        <div className="empty-state repository-empty repository-search-empty">
          <div className="empty-icon">
            <Search size={29} />
          </div>
          <h2>
            {language === "zh"
              ? "没有找到匹配内容"
              : "No matching content"}
          </h2>
          <p>
            {language === "zh"
              ? `没有清单、课程或视频匹配“${searchQuery.trim()}”。`
              : `No list, course or video matches “${searchQuery.trim()}”.`}
          </p>
        </div>
      ) : (
        <div className="repository-list">
          {visibleLists.map(({ list, courses }) => {
            const expanded = searchActive || expandedListIds.has(list.id);
            const isLocal = list.source === "local";
            const createdAt = list.createdAt?.replace("T", " ") || "";
            return (
              <article className="repository-card" key={list.id}>
                <div className="repository-card-head">
                  <button
                    type="button"
                    className="repository-expand"
                    onClick={() => toggleSet(setExpandedListIds, list.id)}
                  >
                    {expanded ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                    <span className="repository-icon">
                      {isLocal ? <FileJson size={20} /> : <Github size={20} />}
                    </span>
                    <span className="repository-copy">
                      <strong>{list.name}</strong>
                      <small>
                        {list.repository} · {list.courses.length}{" "}
                        {language === "zh" ? "门课程" : "courses"} ·{" "}
                        {countLearningListLessons(list)}{" "}
                        {language === "zh" ? "个视频" : "lessons"} ·{" "}
                        {formatDuration(
                          learningListDuration(list),
                          language,
                        )}
                      </small>
                      {(list.author || createdAt) && (
                        <small className="repository-attribution">
                          {list.author
                            ? `${language === "zh" ? "作者" : "By"} ${list.author}`
                            : ""}
                          {list.author && createdAt ? " · " : ""}
                          {createdAt
                            ? `${language === "zh" ? "创建" : "Created"} ${createdAt}`
                            : ""}
                        </small>
                      )}
                    </span>
                    {list.goal && (
                      <span className="repository-goal">{list.goal}</span>
                    )}
                    {isLocal && (
                      <span className="repository-local-badge">
                        {language === "zh" ? "本地" : "Local"}
                      </span>
                    )}
                  </button>

                  <div className="repository-actions">
                    {!isLocal && (
                      <button
                        type="button"
                        onClick={() => onRefresh(list)}
                        title={language === "zh" ? "刷新仓库" : "Refresh"}
                      >
                        <RefreshCw size={15} />
                      </button>
                    )}
                    {!isLocal && list.sourceUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          window.studyflow?.openExternal(list.sourceUrl)
                        }
                        title={language === "zh" ? "打开仓库" : "Open repository"}
                      >
                        <ExternalLink size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger"
                      onClick={() => onRemove(list.id)}
                      title={language === "zh" ? "移除清单" : "Remove list"}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {list.description && (
                  <p className="repository-description">{list.description}</p>
                )}

                {expanded && (
                  <div className="repository-courses">
                    {courses.map(({ course, sections }) => {
                      const courseExpanded =
                        searchActive ||
                        expandedCourseIds.has(`${list.id}:${course.id}`);
                      const lessons = sections.reduce(
                        (total, entry) => total + entry.lessons.length,
                        0,
                      );
                      const courseDuration = sections.reduce(
                        (total, entry) =>
                          total + sumLessonDurations(entry.lessons),
                        0,
                      );
                      return (
                        <section
                          className="repository-course"
                          key={`${list.id}:${course.id}`}
                        >
                          <button
                            type="button"
                            className="repository-course-head"
                            onClick={() =>
                              toggleSet(
                                setExpandedCourseIds,
                                `${list.id}:${course.id}`,
                              )
                            }
                          >
                            <BookOpen size={17} />
                            <span>
                              <strong>{course.title}</strong>
                              <small>
                                {course.sections.length}{" "}
                                {language === "zh" ? "个章节" : "sections"} ·{" "}
                                {lessons}{" "}
                                {language === "zh" ? "个视频" : "lessons"} ·{" "}
                                {formatDuration(courseDuration, language)}
                              </small>
                            </span>
                            {courseExpanded ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </button>

                          {courseExpanded && (
                            <div className="repository-sections">
                              {sections.map(
                                ({ section, lessons: sectionLessons }) => {
                                  const sectionKey = `${list.id}:${course.id}:${section.id}`;
                                  const sectionExpanded =
                                    searchActive ||
                                    expandedSectionIds.has(sectionKey);
                                  return (
                                <div
                                  className="repository-section"
                                  key={`${course.id}:${section.id}`}
                                >
                                  <button
                                    type="button"
                                    className="repository-section-title"
                                    aria-expanded={sectionExpanded}
                                    onClick={() =>
                                      toggleSet(
                                        setExpandedSectionIds,
                                        sectionKey,
                                      )
                                    }
                                  >
                                    <span className="repository-section-name">
                                      {sectionExpanded ? (
                                        <ChevronDown size={14} />
                                      ) : (
                                        <ChevronRight size={14} />
                                      )}
                                      <span>{section.title}</span>
                                    </span>
                                    <small>
                                      {sectionLessons.length}{" "}
                                      {language === "zh" ? "个视频" : "lessons"}{" "}
                                      ·{" "}
                                      {formatDuration(
                                        sumLessonDurations(sectionLessons),
                                        language,
                                      )}
                                    </small>
                                  </button>
                                  {sectionExpanded &&
                                    sectionLessons.map((lesson, lessonIndex) => (
                                      <button
                                        type="button"
                                        className="repository-lesson"
                                        key={`${section.id}:${lesson.id}`}
                                        onClick={() =>
                                          onOpenLesson(
                                            list,
                                            course,
                                            section,
                                            lesson,
                                          )
                                        }
                                      >
                                        <span className="repository-lesson-index">
                                          {String(lessonIndex + 1).padStart(2, "0")}
                                        </span>
                                        <span className="repository-lesson-copy">
                                          <strong>{lesson.title}</strong>
                                          <small>
                                            {lesson.bvid}
                                            {lesson.duration
                                              ? ` · ${formatDuration(
                                                  lesson.duration,
                                                  language,
                                                )}`
                                              : ""}
                                            {lesson.inclusion === "segments"
                                              ? language === "zh"
                                                ? ` · 仅播放 ${lesson.segments.length} 个片段`
                                                : ` · ${lesson.segments.length} selected segments`
                                              : ""}
                                          </small>
                                        </span>
                                        <Play size={15} />
                                      </button>
                                    ))}
                                </div>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
