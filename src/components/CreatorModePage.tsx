import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eraser,
  FilePlus2,
  Github,
  ListVideo,
  LoaderCircle,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { classifyVideo } from "../lib/classifier";
import {
  addLessonToProject,
  allLessons,
  clearCreatorProjectContent,
  createLesson,
  findLessonEntry,
  findLessonForPart,
  mergeSegments,
  normalizeCreatorProject,
  removeProjectCourse,
  removeProjectLessons,
  removeProjectSection,
  stampCreatorProject,
  updateProjectLesson,
} from "../lib/creator";
import { formatDuration } from "../lib/format";
import {
  createMultiPartCollection,
  expandCollectionEpisodes,
  expandCollectionSections,
  hasNavigableCollectionStructure,
} from "../lib/videoCollection";
import type {
  ClassifiedVideo,
  CollectionEpisode,
  CreatorProject,
  Language,
  LearningCourse,
  LearningLesson,
  LearningSection,
  LoginState,
  PlaybackProgress,
  VideoCandidate,
  VideoCollection,
} from "../types";
import { CoverArt } from "./CoverArt";
import { CreatorProjectLibrary } from "./CreatorProjectLibrary";
import { SegmentTimelineEditor } from "./SegmentTimelineEditor";
import { StudyPlayer } from "./StudyPlayer";

interface CreatorSearchRequest {
  id: number;
  query: string;
}

interface CreatorModePageProps {
  language: Language;
  loginState: LoginState;
  project: CreatorProject;
  searchRequest: CreatorSearchRequest | null;
  progressByPart: Record<string, PlaybackProgress>;
  danmakuEnabled: boolean;
  volumePreference: number;
  ratePreference: number;
  qualityPreference: number | null;
  miniPlayerActive: boolean;
  onProjectChange: (project: CreatorProject) => void;
  onToggleDanmaku: () => void;
  onVolumeChange: (value: number) => void;
  onRateChange: (value: number) => void;
  onQualityChange: (value: number) => void;
  onProgressChange: (progress: PlaybackProgress) => void;
  onWatchTime: (seconds: number) => void;
  onToggleMiniPlayer: () => void;
  onToast: (message: string) => void;
}

interface CreatorMedia {
  bvid: string;
  title: string;
  author: string;
  cover: string;
  description: string;
  duration: number;
  cid: number | null;
  page: number | null;
  episodeKey: string;
}

interface DraftSegment {
  id: string;
  start: number;
  end: number;
  title: string;
}

type CollectionLoadState = "idle" | "loading" | "ready" | "single" | "error";
type CollectionScope = "current" | "all" | "manual";
const MAX_LOCAL_IMPORT_BYTES = 5 * 1024 * 1024;

function localId(prefix: string) {
  return `${prefix}-${
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }`;
}

function episodeKey(bvid: string, cid?: number | null) {
  return `${bvid}:${cid || "main"}`;
}

function mediaFromEpisode(
  collection: VideoCollection,
  episode: CollectionEpisode,
  fallback?: ClassifiedVideo | null,
): CreatorMedia {
  return {
    bvid: episode.bvid,
    title:
      collection.total > 1
        ? `${collection.title} · ${episode.title}`
        : episode.title || fallback?.title || "Bilibili video",
    author: fallback?.author || "",
    cover: episode.cover || fallback?.cover || collection.cover,
    description: fallback?.description || "",
    duration: episode.duration || fallback?.duration || 0,
    cid: episode.cid,
    page: collection.kind === "multi-part" ? episode.index : null,
    episodeKey: episodeKey(episode.bvid, episode.cid),
  };
}

function toCandidate(
  item: Awaited<ReturnType<NonNullable<Window["studyflow"]>["creatorSearchVideos"]>>[number],
): VideoCandidate {
  return {
    id: item.id,
    bvid: item.bvid,
    title: item.title,
    description: item.description,
    cover: item.cover,
    author: item.author,
    authorId: "",
    duration: item.duration,
    publishedAt: 0,
    views: item.views,
    likes: 0,
    category: "",
    tags: [],
    position: 0,
    recommendReason: "",
    source: "bilibili",
  };
}

function compactCollectionTitle(
  collection: VideoCollection | null,
  episode: CollectionEpisode | null,
  fallback: string,
) {
  if (!episode) return fallback;
  if (collection?.kind === "multi-part") {
    return `${collection.title} · P${episode.index} ${episode.title}`;
  }
  return episode.title || fallback;
}

export function CreatorModePage({
  language,
  loginState,
  project,
  searchRequest,
  progressByPart,
  danmakuEnabled,
  volumePreference,
  ratePreference,
  qualityPreference,
  miniPlayerActive,
  onProjectChange,
  onToggleDanmaku,
  onVolumeChange,
  onRateChange,
  onQualityChange,
  onProgressChange,
  onWatchTime,
  onToggleMiniPlayer,
  onToast,
}: CreatorModePageProps) {
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [results, setResults] = useState<ClassifiedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] =
    useState<ClassifiedVideo | null>(null);
  const [activeMedia, setActiveMedia] = useState<CreatorMedia | null>(null);
  const [collection, setCollection] = useState<VideoCollection | null>(null);
  const [collectionState, setCollectionState] =
    useState<CollectionLoadState>("idle");
  const [collectionScope, setCollectionScope] =
    useState<CollectionScope>("current");
  const [selectedEpisodeKeys, setSelectedEpisodeKeys] = useState<Set<string>>(
    new Set(),
  );
  const [courseId, setCourseId] = useState(project.courses[0]?.id || "");
  const [sectionId, setSectionId] = useState(
    project.courses[0]?.sections[0]?.id || "",
  );
  const [courseDraft, setCourseDraft] = useState(
    project.courses[0]?.title || "",
  );
  const [sectionDraft, setSectionDraft] = useState(
    project.courses[0]?.sections[0]?.title || "",
  );
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [libraryFullscreen, setLibraryFullscreen] = useState(false);
  const [editingInclusion, setEditingInclusion] = useState<
    "full" | "segments"
  >("full");
  const [editingSegments, setEditingSegments] = useState<DraftSegment[]>([]);
  const [pendingListAction, setPendingListAction] = useState<
    "clear" | "new" | null
  >(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishRepository, setPublishRepository] = useState("");
  const [publishBranch, setPublishBranch] = useState("main");
  const [manifestPath, setManifestPath] = useState("learning-list.json");
  const [createRepository, setCreateRepository] = useState(true);
  const [privateRepository, setPrivateRepository] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubAuth, setGithubAuth] = useState<{
    authenticated: boolean;
    login?: string;
  }>({ authenticated: false });
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const collectionRequestId = useRef(0);
  const biliUserName = loginState.userName?.trim() || "";

  const selectedCourse =
    project.courses.find((course) => course.id === courseId) ||
    project.courses[0] ||
    null;
  const selectedSection =
    selectedCourse?.sections.find((section) => section.id === sectionId) ||
    selectedCourse?.sections[0] ||
    null;
  const creatorSections = useMemo(
    () => expandCollectionSections(collection),
    [collection],
  );
  const episodes = useMemo(
    () => creatorSections.flatMap((section) => section.episodes),
    [creatorSections],
  );
  const currentEpisode = useMemo(
    () =>
      episodes.find(
        (episode) =>
          episodeKey(episode.bvid, episode.cid) === activeMedia?.episodeKey,
      ) || null,
    [episodes, activeMedia?.episodeKey],
  );
  const collectionEpisodeKeys = useMemo(
    () => {
      const keys = new Set(
        episodes.map((episode) => episodeKey(episode.bvid, episode.cid)),
      );
      if (activeMedia) keys.add(activeMedia.episodeKey);
      return keys;
    },
    [episodes, activeMedia?.episodeKey],
  );
  const collectionLessons = useMemo(
    () =>
      allLessons(project).filter(({ lesson }) =>
        collectionEpisodeKeys.has(episodeKey(lesson.bvid, lesson.cid)),
      ),
    [project, collectionEpisodeKeys],
  );
  const projectLessons = useMemo(() => allLessons(project), [project]);
  const lessonCount = projectLessons.length;
  const plannedDuration = useMemo(
    () =>
      projectLessons.reduce((total, { lesson }) => {
        if (lesson.inclusion === "segments") {
          return (
            total +
            lesson.segments.reduce(
              (segmentTotal, segment) =>
                segmentTotal + Math.max(0, segment.end - segment.start),
              0,
            )
          );
        }
        return total + Math.max(0, lesson.duration);
      }, 0),
    [projectLessons],
  );
  const selectionTargetCount =
    collection && collectionScope !== "current"
      ? selectedEpisodeKeys.size
      : activeMedia
        ? 1
        : 0;

  useEffect(() => {
    const accountName = loginState.loggedIn ? biliUserName : "";
    if (project.author === accountName) return;
    onProjectChange({ ...project, author: accountName });
  }, [biliUserName, loginState.loggedIn]);

  useEffect(() => {
    if (!project.courses.some((course) => course.id === courseId)) {
      setCourseId(project.courses[0]?.id || "");
    }
  }, [project.courses, courseId]);

  useEffect(() => {
    setCourseDraft(selectedCourse?.title || "");
  }, [selectedCourse?.id, selectedCourse?.title]);

  useEffect(() => {
    if (!selectedCourse) {
      setSectionId("");
      return;
    }
    if (
      !selectedCourse.sections.some((section) => section.id === sectionId)
    ) {
      setSectionId(selectedCourse.sections[0]?.id || "");
    }
  }, [selectedCourse, sectionId]);

  useEffect(() => {
    if (selectedSection) setSectionDraft(selectedSection.title);
  }, [selectedSection?.id, selectedSection?.title]);

  useEffect(() => {
    if (!searchRequest) return;
    void runSearch(searchRequest.query);
  }, [searchRequest?.id]);

  async function runSearch(keyword: string) {
    const value = keyword.trim();
    if (!value || searchLoading) return;
    setSearchLoading(true);
    setSearchError("");
    setSelectedVideo(null);
    setActiveMedia(null);
    setCollection(null);
    setCollectionState("idle");
    try {
      if (!window.studyflow) throw new Error("Desktop API unavailable");
      const items = await window.studyflow.creatorSearchVideos(value);
      const classified = items.map((item) =>
        classifyVideo(toCandidate(item), "explore", 0, []),
      );
      setResults(classified);
      if (classified.length === 0) {
        setSearchError(
          language === "zh" ? "没有找到相关视频" : "No videos found",
        );
      }
    } catch (reason) {
      setResults([]);
      setSearchError(
        reason instanceof Error
          ? reason.message
          : language === "zh"
            ? "搜索失败"
            : "Search failed",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  async function openSearchResult(video: ClassifiedVideo) {
    const requestId = ++collectionRequestId.current;
    setSelectedVideo(video);
    setCollectionState("loading");
    setCollection(null);
    setSelectedEpisodeKeys(new Set());
    const initialMedia: CreatorMedia = {
      bvid: video.bvid,
      title: video.title,
      author: video.author,
      cover: video.cover,
      description: video.description,
      duration: video.duration,
      cid: null,
      page: null,
      episodeKey: episodeKey(video.bvid, null),
    };
    setActiveMedia(initialMedia);
    try {
      if (!window.studyflow) throw new Error("Desktop API unavailable");
      const [collectionResult, partsResult] = await Promise.all([
        window.studyflow.getVideoCollection(video.bvid).catch(() => null),
        window.studyflow
          .creatorGetVideoParts(video.bvid)
          .catch(() => null),
      ]);
      if (requestId !== collectionRequestId.current) return;

      const resolvedCollection =
        collectionResult && hasNavigableCollectionStructure(collectionResult)
          ? collectionResult
          : createMultiPartCollection({
              bvid: video.bvid,
              title: collectionResult?.title || partsResult?.title || video.title,
              cover:
                collectionResult?.cover || partsResult?.cover || video.cover,
              parts: partsResult?.pages || [],
            });

      if (resolvedCollection) {
        setCollection(resolvedCollection);
        setCollectionState("ready");
        const creatorEpisodes = expandCollectionEpisodes(resolvedCollection);
        const preferredCid = partsResult?.pages[0]?.cid;
        const currentEpisode =
          creatorEpisodes.find(
            (episode) =>
              episode.bvid === video.bvid &&
              (!preferredCid || episode.cid === preferredCid),
          ) ||
          creatorEpisodes.find((episode) => episode.bvid === video.bvid) ||
          creatorEpisodes[0];
        if (currentEpisode) {
          const media = mediaFromEpisode(
            resolvedCollection,
            currentEpisode,
            video,
          );
          setActiveMedia(media);
          setSelectedEpisodeKeys(new Set([media.episodeKey]));
        }
      } else {
        setCollection(null);
        setCollectionState(partsResult?.pages.length ? "single" : "error");
        const firstPart = partsResult?.pages[0];
        setActiveMedia({
          ...initialMedia,
          title: video.title,
          author: partsResult?.author || video.author,
          cover: partsResult?.cover || video.cover,
          duration: firstPart?.duration || video.duration,
          cid: firstPart?.cid || null,
          page: firstPart?.page || null,
          episodeKey: episodeKey(video.bvid, firstPart?.cid),
        });
        if (firstPart) {
          setSelectedEpisodeKeys(
            new Set([episodeKey(video.bvid, firstPart.cid)]),
          );
        }
      }
    } catch {
      if (requestId === collectionRequestId.current) {
        setCollectionState("error");
      }
    }
  }

  function selectEpisode(episode: CollectionEpisode, cid?: number) {
    if (!collection || !selectedVideo) return;
    const media = mediaFromEpisode(
      collection,
      episode,
      selectedVideo,
    );
    if (cid) {
      const variant = episode.variants.find((item) => item.cid === cid);
      media.cid = cid;
      media.duration = variant?.duration || media.duration;
    }
    setActiveMedia(media);
    if (collectionScope === "current") {
      setSelectedEpisodeKeys(new Set([media.episodeKey]));
    } else if (collectionScope === "manual") {
      setSelectedEpisodeKeys((current) => {
        const next = new Set(current);
        next.add(media.episodeKey);
        return next;
      });
    }
  }

  function changeCollectionScope(scope: CollectionScope) {
    setCollectionScope(scope);
    if (scope === "all") {
      setSelectedEpisodeKeys(new Set(collectionEpisodeKeys));
      return;
    }
    if (scope === "current" && activeMedia) {
      setSelectedEpisodeKeys(new Set([activeMedia.episodeKey]));
      return;
    }
    setSelectedEpisodeKeys((current) => {
      if (activeMedia) current.add(activeMedia.episodeKey);
      return new Set(current);
    });
  }

  function toggleEpisodeSelection(key: string) {
    setCollectionScope("manual");
    setSelectedEpisodeKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectedTargetEpisodes() {
    if (!activeMedia) return [];
    if (collection && collectionScope !== "current") {
      return episodes.filter((episode) =>
        selectedEpisodeKeys.has(episodeKey(episode.bvid, episode.cid)),
      );
    }
    if (currentEpisode && collection) return [currentEpisode];
    return [
      {
        id: `single-${activeMedia.bvid}`,
        bvid: activeMedia.bvid,
        cid: activeMedia.cid,
        title: activeMedia.title,
        duration: activeMedia.duration,
        cover: activeMedia.cover,
        index: activeMedia.page || 1,
        variants: [],
      } satisfies CollectionEpisode,
    ];
  }

  function addSelectedVideos() {
    if (!activeMedia || !selectedCourse || !selectedSection) {
      onToast(
        language === "zh"
          ? "请先选择目标课程和章节"
          : "Choose a target course and section first",
      );
      return;
    }
    const targets = selectedTargetEpisodes();
    if (targets.length === 0) {
      onToast(
        language === "zh" ? "请选择至少一个视频" : "Select at least one video",
      );
      return;
    }

    let nextProject = project;
    let created = 0;
    let skipped = 0;
    targets.forEach((episode) => {
      const existing = findLessonForPart(
        nextProject,
        episode.bvid,
        episode.cid,
      );
      if (existing) {
        skipped += 1;
        return;
      }
      const title =
        collection && hasNavigableCollectionStructure(collection)
          ? compactCollectionTitle(
              collection,
              episode,
              activeMedia.title,
            )
          : activeMedia.title;
      const lesson = createLesson({
        title,
        bvid: episode.bvid,
        cid: episode.cid,
        page: collection?.kind === "multi-part" ? episode.index : null,
        duration: episode.duration,
        cover: episode.cover || activeMedia.cover,
        description: activeMedia.description,
        collectionId: collection?.id,
        collectionTitle: collection?.title,
        collectionCover: collection?.cover,
        inclusion: "full",
        segments: [],
      });
      const result = addLessonToProject(
        nextProject,
        selectedCourse.id,
        selectedSection.id,
        lesson,
      );
      nextProject = result.project;
      if (result.added) created += 1;
    });
    if (created > 0) onProjectChange(nextProject);
    onToast(
      created > 0
        ? language === "zh"
          ? `已添加 ${created} 个视频，默认整段；可在视频下方调整范围${skipped > 0 ? `，另有 ${skipped} 个已在清单` : ""}`
          : `Added ${created} video(s) as full videos${skipped > 0 ? `; ${skipped} were already in the list` : ""}. Adjust ranges below the video.`
        : language === "zh"
          ? "所选视频均已在当前清单中"
          : "All selected videos are already in this list",
    );
  }

  function removeAddedCourse(courseId: string) {
    const course = project.courses.find((item) => item.id === courseId);
    if (!course) return;
    const count = course.sections.reduce(
      (total, section) => total + section.lessons.length,
      0,
    );
    onProjectChange(removeProjectCourse(project, courseId));
    onToast(
      language === "zh"
        ? `已删除课程及 ${count} 个视频`
        : `Deleted course and ${count} video(s)`,
    );
  }

  function removeAddedSection(courseId: string, sectionId: string) {
    const section = project.courses
      .find((course) => course.id === courseId)
      ?.sections.find((item) => item.id === sectionId);
    if (!section) return;
    onProjectChange(removeProjectSection(project, courseId, sectionId));
    onToast(
      language === "zh"
        ? `已删除章节及 ${section.lessons.length} 个视频`
        : `Deleted section and ${section.lessons.length} video(s)`,
    );
  }

  function removeAddedCollection(lessonIds: string[]) {
    if (lessonIds.length === 0) return;
    onProjectChange(removeProjectLessons(project, new Set(lessonIds)));
    onToast(
      language === "zh"
        ? `已删除合集中的 ${lessonIds.length} 个视频`
        : `Removed ${lessonIds.length} video(s) from the collection`,
    );
  }

  function resetCreatorWorkspace(nextProject: CreatorProject) {
    const firstCourse = nextProject.courses[0];
    setCourseId(firstCourse?.id || "");
    setSectionId(firstCourse?.sections[0]?.id || "");
    setResults([]);
    setSearchError("");
    setSelectedVideo(null);
    setActiveMedia(null);
    setCollection(null);
    setCollectionState("idle");
    setSelectedEpisodeKeys(new Set());
    setEditingLessonId(null);
  }

  function clearCurrentListContent() {
    const nextProject = clearCreatorProjectContent(project);
    onProjectChange(nextProject);
    resetCreatorWorkspace(nextProject);
    onToast(language === "zh" ? "已清除现有清单内容" : "List content cleared");
  }

  function createNewList() {
    const nextProject = {
      ...normalizeCreatorProject({}),
      author: biliUserName,
    };
    onProjectChange(nextProject);
    resetCreatorWorkspace(nextProject);
    onToast(language === "zh" ? "已新建空白清单" : "New blank list created");
  }

  function requestClearCurrentContent() {
    if (projectLessons.length === 0) {
      clearCurrentListContent();
      return;
    }
    setPendingListAction("clear");
  }

  function requestNewList() {
    const hasMetadata =
      project.name.trim() !== "新的学习清单" ||
      Boolean(project.goal.trim() || project.description.trim());
    if (projectLessons.length === 0 && !hasMetadata) {
      createNewList();
      return;
    }
    setPendingListAction("new");
  }

  function confirmPendingListAction() {
    if (pendingListAction === "clear") clearCurrentListContent();
    if (pendingListAction === "new") createNewList();
    setPendingListAction(null);
  }

  function beginLessonEdit(lesson: LearningLesson) {
    setEditingLessonId(lesson.id);
    setEditingInclusion(lesson.inclusion);
    setEditingSegments(
      lesson.segments.length > 0
        ? lesson.segments.map((segment) => ({ ...segment }))
        : [],
    );
  }

  function saveLessonEdit(lessonId: string) {
    const segments = mergeSegments(editingSegments);
    if (editingInclusion === "segments" && segments.length === 0) {
      onToast(
        language === "zh"
          ? "片段模式至少需要一个有效片段"
          : "Add at least one valid segment",
      );
      return;
    }
    const lesson = findLessonEntry(project, lessonId)?.lesson;
    onProjectChange(
      updateProjectLesson(project, lessonId, {
        duration: lesson ? resolveLessonDuration(lesson) : undefined,
        inclusion: segments.length > 0 ? "segments" : "full",
        segments,
      }),
    );
    setEditingLessonId(null);
    onToast(language === "zh" ? "视频片段已保存" : "Video segments saved");
  }

  function saveLibraryLesson(
    lessonId: string,
    inclusion: "full" | "segments",
    segments: DraftSegment[],
  ) {
    const validSegments = mergeSegments(segments);
    if (inclusion === "segments" && validSegments.length === 0) {
      onToast(
        language === "zh"
          ? "片段模式至少需要一个有效片段"
          : "Add at least one valid segment",
      );
      return;
    }
    const lesson = findLessonEntry(project, lessonId)?.lesson;
    onProjectChange(
      updateProjectLesson(project, lessonId, {
        duration: lesson?.duration,
        inclusion: validSegments.length > 0 ? "segments" : "full",
        segments: validSegments,
      }),
    );
    onToast(language === "zh" ? "视频参数已保存" : "Video settings saved");
  }

  function renderLibraryMonitor(lesson: LearningLesson) {
    const video: ClassifiedVideo = {
      id: lesson.id,
      bvid: lesson.bvid,
      title: lesson.title,
      description: lesson.description,
      cover: lesson.cover || lesson.collectionCover || "",
      author: "",
      authorId: "",
      duration: lesson.duration,
      publishedAt: 0,
      views: 0,
      likes: 0,
      category: "",
      tags: [],
      position: 0,
      recommendReason: "",
      source: "bilibili",
      learningScore: 0,
      subject: "general",
      route: "learning",
      reasons: [],
      hidden: false,
      feedback: 0,
    };

    return (
      <StudyPlayer
        key={`library-monitor-${lesson.id}-${lesson.cid || "main"}`}
        video={video}
        cid={lesson.cid || undefined}
        language={language}
        danmakuEnabled={danmakuEnabled}
        volumePreference={volumePreference}
        ratePreference={ratePreference}
        qualityPreference={qualityPreference}
        progressByPart={progressByPart}
        miniPlayerActive={miniPlayerActive}
        collectionTitle={lesson.collectionTitle}
        partLabel={lesson.title}
        segmentPlan={lesson}
        onToggleDanmaku={onToggleDanmaku}
        onVolumeChange={onVolumeChange}
        onRateChange={onRateChange}
        onQualityChange={onQualityChange}
        onProgressChange={onProgressChange}
        onWatchTime={onWatchTime}
        onToggleMiniPlayer={onToggleMiniPlayer}
        onEnded={() => undefined}
      />
    );
  }

  function jumpToManagedLesson(lesson: LearningLesson) {
    const episode = episodes.find(
      (item) =>
        episodeKey(item.bvid, item.cid) === episodeKey(lesson.bvid, lesson.cid),
    );
    if (episode) {
      selectEpisode(episode);
      return;
    }
    if (!activeMedia) return;
    setActiveMedia({
      ...activeMedia,
      bvid: lesson.bvid,
      title: lesson.title,
      cover: lesson.cover || activeMedia.cover,
      duration: lesson.duration,
      cid: lesson.cid,
      page: lesson.page || null,
      episodeKey: episodeKey(lesson.bvid, lesson.cid),
    });
  }

  function resolveLessonDuration(lesson: LearningLesson) {
    if (
      activeMedia &&
      activeMedia.bvid === lesson.bvid &&
      (activeMedia.cid || null) === (lesson.cid || null) &&
      activeMedia.duration > 0
    ) {
      return activeMedia.duration;
    }
    const episode = episodes.find(
      (item) =>
        episodeKey(item.bvid, item.cid) === episodeKey(lesson.bvid, lesson.cid),
    );
    return episode?.duration || lesson.duration || 0;
  }

  function updateProjectMeta(
    field: "name" | "description" | "goal",
    value: string,
  ) {
    onProjectChange({ ...project, [field]: value });
  }

  function commitCourseDraft() {
    const title = courseDraft.trim();
    if (!title) return;
    const existing = project.courses.find(
      (course) =>
        course.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
    );
    if (existing) {
      if (existing.id !== courseId) {
        const nextSection = existing.sections[0];
        setCourseId(existing.id);
        setSectionId(nextSection?.id || "");
        if (nextSection) setSectionDraft(nextSection.title);
      }
      setCourseDraft(existing.title);
      return;
    }
    const course: LearningCourse = {
      id: localId("course"),
      title,
      description: "",
      cover: "",
      author: "",
      sections: [],
    };
    onProjectChange({
      ...project,
      courses: [...project.courses, course],
    });
    setCourseId(course.id);
    setSectionId("");
    setCourseDraft(course.title);
  }

  function changeCourseDraft(value: string) {
    setCourseDraft(value);
  }

  function commitSectionDraft() {
    if (!selectedCourse) return;
    const title = sectionDraft.trim();
    if (!title) return;
    const existing = selectedCourse.sections.find(
      (section) =>
        section.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
    );
    if (existing) {
      setSectionId(existing.id);
      setSectionDraft(existing.title);
      return;
    }
    const section: LearningSection = {
      id: localId("section"),
      title,
      lessons: [],
    };
    onProjectChange({
      ...project,
      courses: project.courses.map((course) =>
        course.id === selectedCourse.id
          ? { ...course, sections: [...course.sections, section] }
          : course,
      ),
    });
    setSectionId(section.id);
    setSectionDraft(section.title);
  }

  function changeSectionDraft(value: string) {
    setSectionDraft(value);
  }

  function exportJson() {
    if (!biliUserName) {
      onToast(
        language === "zh"
          ? "请先登录 B 站账号，再导出清单"
          : "Sign in to Bilibili before exporting",
      );
      return;
    }
    const exportProject = stampCreatorProject(project, biliUserName);
    const blob = new Blob([JSON.stringify(exportProject, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "learning-list.json";
    anchor.click();
    URL.revokeObjectURL(url);
    onProjectChange(exportProject);
    onToast(
      language === "zh"
        ? `清单已导出，时间：${exportProject.createdAt.replace("T", " ")}`
        : `Exported at ${exportProject.createdAt.replace("T", " ")}`,
    );
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_LOCAL_IMPORT_BYTES) {
      onToast(
        language === "zh"
          ? "学习清单不能超过 5 MB"
          : "Learning lists cannot exceed 5 MB",
      );
      if (importInput.current) importInput.current.value = "";
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      onProjectChange({
        ...normalizeCreatorProject(parsed),
        author: biliUserName,
      });
      onToast(language === "zh" ? "学习清单已导入" : "Learning list imported");
    } catch (reason) {
      onToast(
        reason instanceof Error
          ? reason.message
          : language === "zh"
            ? "导入失败"
            : "Import failed",
      );
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }

  async function openPublish() {
    setPublishOpen(true);
    setPublishMessage("");
    if (!window.studyflow) return;
    try {
      const auth = await window.studyflow.creatorGetAuthState();
      setGithubAuth(auth);
      if (auth.login) setPublishRepository(`${auth.login}/learning-list`);
    } catch {
      setGithubAuth({ authenticated: false });
    }
  }

  async function saveGithubToken() {
    if (!window.studyflow || !githubToken.trim()) return;
    setPublishBusy(true);
    setPublishMessage("");
    try {
      const auth = await window.studyflow.creatorSaveToken(githubToken.trim());
      setGithubAuth({ authenticated: true, login: auth.login });
      setGithubToken("");
      if (!publishRepository) {
        setPublishRepository(`${auth.login}/learning-list`);
      }
      setPublishMessage(
        language === "zh"
          ? `已连接 GitHub：${auth.login}`
          : `Connected to GitHub as ${auth.login}`,
      );
    } catch (reason) {
      setPublishMessage(
        reason instanceof Error ? reason.message : "GitHub token failed",
      );
    } finally {
      setPublishBusy(false);
    }
  }

  async function publishProject() {
    if (!window.studyflow || !publishRepository.trim()) return;
    if (!biliUserName) {
      setPublishMessage(
        language === "zh"
          ? "请先登录 B 站账号，再发布清单。"
          : "Sign in to Bilibili before publishing.",
      );
      return;
    }
    const exportProject = stampCreatorProject(project, biliUserName);
    setPublishBusy(true);
    setPublishMessage("");
    try {
      const result = await window.studyflow.creatorPublish({
        repository: publishRepository.trim(),
        branch: publishBranch.trim() || "main",
        manifestPath: manifestPath.trim() || "learning-list.json",
        createRepository,
        private: privateRepository,
        project: exportProject,
      });
      onProjectChange(exportProject);
      setPublishMessage(
        language === "zh"
          ? `发布成功：${result.repositoryUrl}`
          : `Published: ${result.repositoryUrl}`,
      );
    } catch (reason) {
      setPublishMessage(
        reason instanceof Error ? reason.message : "Publish failed",
      );
    } finally {
      setPublishBusy(false);
    }
  }

  const activeClassifiedVideo = useMemo<ClassifiedVideo | null>(() => {
    if (!selectedVideo || !activeMedia) return null;
    return {
      ...selectedVideo,
      bvid: activeMedia.bvid,
      title: activeMedia.title,
      author: activeMedia.author,
      cover: activeMedia.cover,
      description: activeMedia.description,
      duration: activeMedia.duration,
    };
  }, [selectedVideo, activeMedia]);

  const activeEpisodeIndex = currentEpisode
    ? episodes.findIndex((episode) => episode.id === currentEpisode.id)
    : -1;
  const nextEpisode =
    activeEpisodeIndex >= 0 ? episodes[activeEpisodeIndex + 1] : null;

  return (
    <section className="creator-workspace">
      <div className="creator-content">
        <div className="creator-commandbar">
          <div className="creator-project-fields">
            <input
              className="creator-name-input"
              value={project.name}
              onChange={(event) => updateProjectMeta("name", event.target.value)}
              aria-label={language === "zh" ? "清单名称" : "List name"}
              placeholder={language === "zh" ? "清单名称" : "List name"}
            />
            <input
              className="creator-author-input"
              value={biliUserName}
              readOnly
              aria-label={
                language === "zh"
                  ? "作者，来自 B 站账号昵称"
                  : "Author, from Bilibili account"
              }
              placeholder={
                language === "zh" ? "登录后自动获取" : "Sign in to load"
              }
              title={
                language === "zh"
                  ? "作者自动读取当前 B 站账号昵称"
                  : "Author comes from the current Bilibili account"
              }
            />
            <input
              className="creator-goal-input"
              value={project.goal}
              onChange={(event) => updateProjectMeta("goal", event.target.value)}
              aria-label={language === "zh" ? "学习目标" : "Learning goal"}
              placeholder={language === "zh" ? "学习目标" : "Learning goal"}
            />
            <input
              className="creator-description-input"
              value={project.description}
              onChange={(event) =>
                updateProjectMeta("description", event.target.value)
              }
              aria-label={language === "zh" ? "清单描述" : "Description"}
              placeholder={language === "zh" ? "清单描述" : "Description"}
            />
          </div>
          <div className="creator-project-actions">
            <button
              type="button"
              className="creator-new-list-button"
              onClick={requestNewList}
            >
              <FilePlus2 size={15} />
              {language === "zh" ? "新建清单" : "New list"}
            </button>
            <button
              type="button"
              className="creator-clear-button"
              onClick={requestClearCurrentContent}
            >
              <Eraser size={15} />
              {language === "zh" ? "清除现有内容" : "Clear content"}
            </button>
            <input
              ref={importInput}
              className="hidden-file-input"
              type="file"
              accept=".json,application/json"
              onChange={(event) => importJson(event.target.files?.[0])}
            />
            <button type="button" onClick={() => importInput.current?.click()}>
              <Upload size={15} />
              {language === "zh" ? "导入" : "Import"}
            </button>
            <button type="button" onClick={exportJson}>
              <Download size={15} />
              {language === "zh" ? "导出" : "Export"}
            </button>
            <button type="button" className="publish" onClick={openPublish}>
              <Github size={15} />
              {language === "zh" ? "发布" : "Publish"}
            </button>
          </div>
        </div>

        <div className="creator-target-row">
          <div className="creator-target-heading">
            <span>{language === "zh" ? "加入位置" : "Destination"}</span>
            <strong>{lessonCount} {language === "zh" ? "个视频" : "videos"}</strong>
          </div>
          <label className="creator-target-field creator-course-field">
            <span>{language === "zh" ? "课程" : "Course"}</span>
            <input
              list="creator-course-options"
              value={courseDraft}
              onChange={(event) => changeCourseDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitCourseDraft();
                }
                if (event.key === "Escape") {
                  setCourseDraft(selectedCourse?.title || "");
                }
              }}
              placeholder={language === "zh" ? "选择或输入课程" : "Select or enter a course"}
              aria-label={language === "zh" ? "选择或新建课程" : "Select or create a course"}
            />
            <datalist id="creator-course-options">
              {project.courses.map((course) => (
                <option key={course.id} value={course.title} />
              ))}
            </datalist>
          </label>
          <button
            type="button"
            className="icon-button creator-target-add creator-course-add"
            onClick={commitCourseDraft}
            title={
              language === "zh"
                ? "选择已有同名课程，不存在则新建"
                : "Select an existing course or create one"
            }
          >
            <Plus size={15} />
          </button>
          <label className="creator-target-field creator-section-field">
            <span>{language === "zh" ? "章节" : "Section"}</span>
            <input
              list="creator-section-options"
              value={sectionDraft}
              onChange={(event) => changeSectionDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitSectionDraft();
                }
                if (event.key === "Escape") {
                  setSectionDraft(selectedSection?.title || "");
                }
              }}
              placeholder={language === "zh" ? "选择或输入章节" : "Select or enter a section"}
              aria-label={language === "zh" ? "选择或新建章节" : "Select or create a section"}
            />
            <datalist id="creator-section-options">
              {selectedCourse?.sections.map((section) => (
                <option key={section.id} value={section.title} />
              ))}
            </datalist>
          </label>
          <button
            type="button"
            className="icon-button creator-target-add creator-section-add"
            onClick={commitSectionDraft}
            title={
              language === "zh"
                ? "选择已有同名章节，不存在则新建"
                : "Select an existing section or create one"
            }
          >
            <Plus size={15} />
          </button>
        </div>

        {!selectedVideo ? (
          <div className="creator-search-results">
            <div className="creator-section-heading">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-dot" />
                  BILIBILI / RAW SEARCH
                </span>
                <h1>
                  {language === "zh"
                    ? "从完整内容库挑选课程"
                    : "Choose from the complete video library"}
                </h1>
                <p>
                  {language === "zh"
                    ? "搜索结果不经过学习模式过滤。进入视频后可查看合集、分P并设置清单规则。"
                    : "Search is not filtered by learning mode. Open a result to inspect its series, parts and list rules."}
                </p>
              </div>
              <span>{results.length} {language === "zh" ? "个结果" : "results"}</span>
            </div>

            {searchError && <div className="creator-inline-error">{searchError}</div>}

            {searchLoading ? (
              <div className="creator-empty-state">
                <LoaderCircle className="spin" size={25} />
                <span>{language === "zh" ? "正在搜索完整 B 站结果" : "Searching all Bilibili results"}</span>
              </div>
            ) : results.length > 0 ? (
              <div className="creator-result-grid">
                {results.map((video) => (
                  <button
                    type="button"
                    className="creator-result-card"
                    key={video.id}
                    onClick={() => openSearchResult(video)}
                  >
                    <span className="creator-result-cover">
                      <CoverArt
                        cover={video.cover}
                        title={video.title}
                        subject={video.subject}
                      />
                      <span>{formatDuration(video.duration, language)}</span>
                    </span>
                    <span className="creator-result-copy">
                      <strong>{video.title}</strong>
                      <small>{video.author}</small>
                      <span>
                        <Video size={13} />
                        {language === "zh" ? "打开视频主页" : "Open video page"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : projectLessons.length === 0 ? (
              <div className="creator-empty-state">
                <Search size={29} />
                <strong>{language === "zh" ? "搜索任意视频开始制作" : "Search any video to begin"}</strong>
                <span>
                  {language === "zh"
                    ? "使用上方搜索栏，支持单P视频、多P投稿和 B 站合集。"
                    : "Use the top search bar for single videos, multi-part uploads and Bilibili series."}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <button
              type="button"
              className="creator-result-back"
              onClick={() => {
                setSelectedVideo(null);
                setActiveMedia(null);
                setCollection(null);
              }}
            >
              <ArrowLeft size={15} />
              {language === "zh" ? "返回搜索结果" : "Back to results"}
            </button>

            <div className="creator-video-layout">
              <div className="creator-video-main">
                {activeClassifiedVideo && !libraryFullscreen && (
                  <div className="creator-player-shell">
                    <StudyPlayer
                      key={`${activeClassifiedVideo.bvid}-${activeMedia?.cid || "main"}`}
                      video={activeClassifiedVideo}
                      cid={activeMedia?.cid || undefined}
                      language={language}
                      danmakuEnabled={danmakuEnabled}
                      volumePreference={volumePreference}
                      ratePreference={ratePreference}
                      qualityPreference={qualityPreference}
                      progressByPart={progressByPart}
                      miniPlayerActive={miniPlayerActive}
                      onToggleDanmaku={onToggleDanmaku}
                      onVolumeChange={onVolumeChange}
                      onRateChange={onRateChange}
                      onQualityChange={onQualityChange}
                      onProgressChange={onProgressChange}
                      onWatchTime={onWatchTime}
                      onToggleMiniPlayer={onToggleMiniPlayer}
                      onEnded={() => {
                        if (nextEpisode) {
                          selectEpisode(nextEpisode);
                        }
                      }}
                    />
                  </div>
                )}
                <div className="creator-video-heading">
                  <div>
                    <span>{activeMedia?.bvid}</span>
                    <h1>{activeMedia?.title}</h1>
                    <p>
                      {activeMedia?.author}
                      {activeMedia?.duration
                        ? ` · ${formatDuration(activeMedia.duration, language)}`
                        : ""}
                    </p>
                  </div>
                </div>

                <section className="creator-added-strip">
                  <div className="creator-added-strip-head">
                    <div>
                      <span>
                        {language === "zh"
                          ? "当前合集已添加"
                          : "In this collection"}
                      </span>
                      <strong>
                        {language === "zh"
                          ? "逐项设置整段或片段"
                          : "Set full or segmented playback per video"}
                      </strong>
                    </div>
                    <small>
                      {collectionLessons.length}{" "}
                      {language === "zh" ? "个视频" : "videos"}
                    </small>
                  </div>

                  {collectionLessons.length === 0 ? (
                    <div className="creator-added-empty">
                      <ListVideo size={18} />
                      <span>
                        {language === "zh"
                          ? "通过右侧合集面板选择视频，再点击“添加视频”。"
                          : "Select videos in the series panel, then choose Add video."}
                      </span>
                    </div>
                  ) : (
                    <div className="creator-added-cards">
                      {collectionLessons.map(({ lesson }) => {
                        const expanded = editingLessonId === lesson.id;
                        const duration = resolveLessonDuration(lesson);
                        const isFull =
                          lesson.inclusion === "full" ||
                          lesson.segments.length === 0;
                        const active =
                          activeMedia?.bvid === lesson.bvid &&
                          (activeMedia?.cid || null) === (lesson.cid || null);

                        return (
                          <article
                            className={[
                              "creator-added-card",
                              active ? "active" : "",
                              expanded ? "expanded" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            key={lesson.id}
                          >
                            <div className="creator-added-card-top">
                              <button
                                type="button"
                                className="creator-added-card-main"
                                onClick={() => jumpToManagedLesson(lesson)}
                              >
                                <span className="creator-added-thumb">
                                  <CoverArt
                                    cover={lesson.collectionCover || lesson.cover}
                                    title={lesson.title}
                                    subject="general"
                                  />
                                </span>
                                <span className="creator-added-copy">
                                  <strong title={lesson.title}>
                                    {lesson.title}
                                  </strong>
                                  <small>
                                    {formatDuration(duration, language)} ·{" "}
                                    {isFull
                                      ? language === "zh"
                                        ? "整段"
                                        : "Full"
                                      : language === "zh"
                                        ? `${lesson.segments.length} 个片段`
                                        : `${lesson.segments.length} segments`}
                                  </small>
                                </span>
                              </button>
                              <button
                                type="button"
                                className="creator-added-expand"
                                onClick={() =>
                                  expanded
                                    ? setEditingLessonId(null)
                                    : beginLessonEdit(lesson)
                                }
                                aria-expanded={expanded}
                                title={
                                  expanded
                                    ? language === "zh"
                                      ? "收起范围设置"
                                      : "Collapse range editor"
                                    : language === "zh"
                                      ? "展开范围设置"
                                      : "Expand range editor"
                                }
                              >
                                {expanded ? (
                                  <ChevronDown size={15} />
                                ) : (
                                  <ChevronRight size={15} />
                                )}
                              </button>
                            </div>

                            <span
                              className="creator-added-progress"
                              aria-hidden="true"
                            >
                              <span className="creator-added-progress-track">
                                {isFull ? (
                                  <i className="full" />
                                ) : (
                                  lesson.segments.map((segment) => {
                                    const progressDuration = Math.max(
                                      duration,
                                      segment.end,
                                      1,
                                    );
                                    const left =
                                      (Math.max(0, segment.start) /
                                        progressDuration) *
                                      100;
                                    const width =
                                      (Math.max(
                                        0,
                                        segment.end - segment.start,
                                      ) /
                                        progressDuration) *
                                      100;
                                    return (
                                      <i
                                        key={segment.id}
                                        style={{
                                          left: `${Math.min(left, 100)}%`,
                                          width: `${Math.min(width, 100)}%`,
                                        }}
                                      />
                                    );
                                  })
                                )}
                              </span>
                            </span>

                            {expanded && (
                              <div className="creator-added-editor">
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
                                    {language === "zh" ? "播放整段" : "Full"}
                                  </button>
                                  <button
                                    type="button"
                                    className={
                                      editingInclusion === "segments"
                                        ? "active"
                                        : ""
                                    }
                                    onClick={() =>
                                      setEditingInclusion("segments")
                                    }
                                  >
                                    <Scissors size={12} />
                                    {language === "zh" ? "指定片段" : "Segments"}
                                  </button>
                                </div>

                                {editingInclusion === "segments" && (
                                  <SegmentTimelineEditor
                                    language={language}
                                    duration={duration}
                                    segments={editingSegments}
                                    onChange={setEditingSegments}
                                  />
                                )}

                                <div className="creator-inline-actions">
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => {
                                      onProjectChange(
                                        removeProjectLessons(
                                          project,
                                          new Set([lesson.id]),
                                        ),
                                      );
                                      setEditingLessonId(null);
                                    }}
                                  >
                                    <Trash2 size={12} />
                                    {language === "zh" ? "移出清单" : "Remove"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingLessonId(null)}
                                  >
                                    {language === "zh" ? "取消" : "Cancel"}
                                  </button>
                                  <button
                                    type="button"
                                    className="accent"
                                    onClick={() => saveLessonEdit(lesson.id)}
                                  >
                                    <Check size={12} />
                                    {language === "zh" ? "保存" : "Save"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <aside className="creator-collection-panel">
                <div className="creator-panel-title">
                  <div>
                    <span>
                      {language === "zh" ? "视频合集" : "Video series"}
                    </span>
                    <strong>
                      {collection?.title ||
                        (collectionState === "single"
                          ? language === "zh"
                            ? "单集视频"
                            : "Single video"
                          : language === "zh"
                            ? "读取中"
                            : "Loading")}
                    </strong>
                  </div>
                  <ListVideo size={18} />
                </div>

                {collectionState === "loading" && (
                  <div className="creator-collection-state">
                    <LoaderCircle className="spin" size={20} />
                    {language === "zh" ? "正在读取合集" : "Loading series"}
                  </div>
                )}
                {collectionState === "error" && (
                  <div className="creator-collection-state error">
                    {language === "zh" ? "合集读取失败" : "Unable to load series"}
                  </div>
                )}
                {collectionState === "single" && (
                  <div className="creator-collection-state">
                    <Video size={20} />
                    {language === "zh" ? "当前为单集视频" : "This is a single video"}
                  </div>
                )}

                {collectionState === "ready" && collection && (
                  <>
                    <div className="creator-scope-tabs">
                      <button
                        type="button"
                        className={collectionScope === "current" ? "active" : ""}
                        onClick={() => changeCollectionScope("current")}
                      >
                        {language === "zh" ? "当前视频" : "Current"}
                      </button>
                      <button
                        type="button"
                        className={collectionScope === "all" ? "active" : ""}
                        onClick={() => changeCollectionScope("all")}
                      >
                        {language === "zh" ? "全部合集" : "All"}
                      </button>
                      <button
                        type="button"
                        className={collectionScope === "manual" ? "active" : ""}
                        onClick={() => changeCollectionScope("manual")}
                      >
                        {language === "zh" ? "单独勾选" : "Select"}
                      </button>
                    </div>
                    <div className="creator-collection-sections">
                      {creatorSections.map((section) => (
                        <section key={section.id}>
                          <div className="creator-collection-section-head">
                            <span>{section.title}</span>
                            <small>{section.episodes.length}</small>
                          </div>
                          {section.episodes.map((episode) => {
                            const key = episodeKey(episode.bvid, episode.cid);
                            const active = activeMedia?.episodeKey === key;
                            return (
                              <div
                                className={
                                  active
                                    ? "creator-episode-row active"
                                    : "creator-episode-row"
                                }
                                key={`${section.id}-${episode.id}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedEpisodeKeys.has(key)}
                                  onChange={() => toggleEpisodeSelection(key)}
                                  aria-label={episode.title}
                                />
                                <button
                                  type="button"
                                  onClick={() => selectEpisode(episode)}
                                >
                                  <span>{String(episode.index).padStart(2, "0")}</span>
                                  <strong>{episode.title}</strong>
                                  <small>
                                    {formatDuration(episode.duration, language)}
                                  </small>
                                </button>
                              </div>
                            );
                          })}
                        </section>
                      ))}
                    </div>
                  </>
                )}

                <div className="creator-collection-add">
                  <div>
                    <strong>
                      {selectionTargetCount}{" "}
                      {language === "zh" ? "个视频已选择" : "selected"}
                    </strong>
                    <small>
                      {language === "zh"
                        ? "新加入的视频默认整段播放"
                        : "New videos start with full playback"}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={addSelectedVideos}
                    disabled={!activeMedia || selectionTargetCount === 0}
                  >
                    <Plus size={14} />
                    {language === "zh" ? "添加视频" : "Add video"}
                  </button>
                </div>
              </aside>
            </div>

          </>
        )}
      </div>

      <CreatorProjectLibrary
        language={language}
        project={project}
        lessonCount={lessonCount}
        plannedDuration={plannedDuration}
        onRemoveCourse={removeAddedCourse}
        onRemoveSection={removeAddedSection}
        onRemoveCollection={removeAddedCollection}
      onSaveLesson={saveLibraryLesson}
      renderLessonMonitor={renderLibraryMonitor}
      onFullscreenChange={setLibraryFullscreen}
      />

      {pendingListAction && (
        <div className="creator-modal-backdrop" role="presentation">
          <section
            className="creator-publish-modal creator-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              pendingListAction === "clear"
                ? language === "zh"
                  ? "清除现有内容"
                  : "Clear list content"
                : language === "zh"
                  ? "新建清单"
                  : "Create a new list"
            }
          >
            <button
              type="button"
              className="creator-modal-close"
              onClick={() => setPendingListAction(null)}
            >
              <X size={17} />
            </button>
            <div className="creator-publish-title">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                LIST ACTION
              </span>
              <h2>
                {pendingListAction === "clear"
                  ? language === "zh"
                    ? "清除现有内容"
                    : "Clear list content"
                  : language === "zh"
                    ? "新建空白清单"
                    : "Create a new blank list"}
              </h2>
              <p>
                {pendingListAction === "clear"
                  ? language === "zh"
                    ? `将清除 ${lessonCount} 个视频以及当前课程、章节结构。名称、目标和描述会保留。`
                    : `This removes ${lessonCount} videos and the current course structure while keeping the name, goal, and description.`
                  : language === "zh"
                    ? `将放弃当前清单的元数据和 ${lessonCount} 个视频，并创建一份全新的空白清单。`
                    : `This discards the current metadata and ${lessonCount} videos, then creates a blank list.`}
              </p>
            </div>
            <div className="creator-confirm-actions">
              <button
                type="button"
                onClick={() => setPendingListAction(null)}
              >
                {language === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                type="button"
                className="danger"
                onClick={confirmPendingListAction}
              >
                {pendingListAction === "clear"
                  ? language === "zh"
                    ? "确认清除"
                    : "Clear content"
                  : language === "zh"
                    ? "确认新建"
                    : "Create new list"}
              </button>
            </div>
          </section>
        </div>
      )}

      {publishOpen && (
        <div className="creator-modal-backdrop" role="presentation">
          <section
            className="creator-publish-modal"
            role="dialog"
            aria-modal="true"
            aria-label={language === "zh" ? "发布学习清单" : "Publish learning list"}
          >
            <button
              type="button"
              className="creator-modal-close"
              onClick={() => setPublishOpen(false)}
            >
              <X size={17} />
            </button>
            <div className="creator-publish-title">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                GITHUB
              </span>
              <h2>{language === "zh" ? "发布学习清单" : "Publish learning list"}</h2>
              <p>
                {language === "zh"
                  ? "将当前可视化清单和 JSON 发布到 GitHub 仓库。"
                  : "Publish the current visual list and JSON to a GitHub repository."}
              </p>
            </div>

            <div className="creator-github-auth">
              <span>
                {githubAuth.authenticated
                  ? `GitHub: ${githubAuth.login}`
                  : language === "zh"
                    ? "尚未连接 GitHub Token"
                    : "GitHub token is not connected"}
              </span>
              <div>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(event) => setGithubToken(event.target.value)}
                  placeholder="GitHub Personal Access Token"
                />
                <button type="button" onClick={saveGithubToken} disabled={publishBusy}>
                  {language === "zh" ? "保存 Token" : "Save token"}
                </button>
              </div>
            </div>

            <div className="creator-publish-fields">
              <label>
                <span>{language === "zh" ? "仓库" : "Repository"}</span>
                <input
                  value={publishRepository}
                  onChange={(event) => setPublishRepository(event.target.value)}
                  placeholder="owner/repository"
                />
              </label>
              <label>
                <span>{language === "zh" ? "分支" : "Branch"}</span>
                <input
                  value={publishBranch}
                  onChange={(event) => setPublishBranch(event.target.value)}
                />
              </label>
              <label>
                <span>{language === "zh" ? "清单路径" : "Manifest path"}</span>
                <input
                  value={manifestPath}
                  onChange={(event) => setManifestPath(event.target.value)}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={createRepository}
                  onChange={(event) => setCreateRepository(event.target.checked)}
                />
                <span>{language === "zh" ? "仓库不存在时创建" : "Create if missing"}</span>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={privateRepository}
                  onChange={(event) => setPrivateRepository(event.target.checked)}
                />
                <span>{language === "zh" ? "创建为私有仓库" : "Create as private"}</span>
              </label>
            </div>
            {publishMessage && (
              <div className="creator-publish-message">{publishMessage}</div>
            )}
            <button
              type="button"
              className="creator-publish-submit"
              onClick={publishProject}
              disabled={publishBusy || !githubAuth.authenticated}
            >
              {publishBusy ? <LoaderCircle className="spin" size={16} /> : <Github size={16} />}
              {language === "zh" ? "上传并发布" : "Upload and publish"}
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
