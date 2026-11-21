import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ListVideo,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ClassifiedVideo,
  CollectionEpisode,
  Language,
  LearningPlaybackSession,
  PlaybackProgress,
  VideoCollection,
} from "../types";
import {
  formatCompactNumber,
  formatDuration,
} from "../lib/format";
import { subjectLabel, translate } from "../i18n";
import { StudyPlayer } from "./StudyPlayer";
import { VideoCard } from "./VideoCard";
import { CourseNotes } from "./CourseNotes";
import { VideoComments } from "./VideoComments";
import { videoKey } from "../lib/videoKey";
import { groupCollectionVariants } from "../lib/collectionVariants";
import { buildVideoPartQueue } from "../lib/playbackQueue";
import {
  countCollectionPlayableParts,
  hasNavigableCollectionStructure,
} from "../lib/videoCollection";

interface VideoPageProps {
  language: Language;
  video: ClassifiedVideo;
  related: ClassifiedVideo[];
  saved: boolean;
  showScores: boolean;
  savedSet: Set<string>;
  danmakuEnabled: boolean;
  volumePreference: number;
  ratePreference: number;
  qualityPreference: number | null;
  progressByPart: Record<string, PlaybackProgress>;
  miniPlayerActive: boolean;
  learningSession: LearningPlaybackSession | null;
  onBack: () => void;
  onSave: (video: ClassifiedVideo) => void;
  onFeedback: (video: ClassifiedVideo, value: number) => void;
  onBlockAuthor: (author: string) => void;
  onOpen: (video: ClassifiedVideo) => void;
  onToggleDanmaku: () => void;
  onVolumeChange: (value: number) => void;
  onRateChange: (value: number) => void;
  onQualityChange: (value: number) => void;
  onProgressChange: (progress: PlaybackProgress) => void;
  onWatchTime: (seconds: number) => void;
  onToggleMiniPlayer: () => void;
  onNextLearningLesson: () => void;
}

type CollectionStatus = "loading" | "ready" | "empty" | "error";

export function VideoPage({
  language,
  video,
  related,
  saved,
  showScores,
  savedSet,
  danmakuEnabled,
  volumePreference,
  ratePreference,
  qualityPreference,
  progressByPart,
  miniPlayerActive,
  learningSession,
  onBack,
  onSave,
  onFeedback,
  onBlockAuthor,
  onOpen,
  onToggleDanmaku,
  onVolumeChange,
  onRateChange,
  onQualityChange,
  onProgressChange,
  onWatchTime,
  onToggleMiniPlayer,
  onNextLearningLesson,
}: VideoPageProps) {
  const [collectionStatus, setCollectionStatus] =
    useState<CollectionStatus>("loading");
  const [collection, setCollection] = useState<VideoCollection | null>(null);
  const [activeEpisode, setActiveEpisode] =
    useState<CollectionEpisode | null>(null);
  const [expandedVariantGroupIds, setExpandedVariantGroupIds] = useState<
    Set<string>
  >(new Set());
  const [expandedEpisodeIds, setExpandedEpisodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [playerPlaylistOpen, setPlayerPlaylistOpen] = useState(false);
  const [playerControlsVisible, setPlayerControlsVisible] = useState(true);
  const [playerPlaylistTab, setPlayerPlaylistTab] = useState<
    "parts" | "collection"
  >("parts");
  const [pendingTimelineSeek, setPendingTimelineSeek] = useState<
    number | null
  >(null);
  const [autoPlayPart, setAutoPlayPart] = useState(false);
  const [playerLoadVersion, setPlayerLoadVersion] = useState(0);
  const [collectionPanelOpen, setCollectionPanelOpen] = useState(() => {
    try {
      return localStorage.getItem("studyflow.collectionPanelOpen") !== "false";
    } catch {
      return true;
    }
  });
  const orderedEpisodes = useMemo(
    () => collection?.sections.flatMap((section) => section.episodes) || [],
    [collection],
  );
  const playbackQueue = useMemo(
    () => buildVideoPartQueue(collection, activeEpisode),
    [collection, activeEpisode],
  );
  const collectionPartCount = useMemo(
    () => countCollectionPlayableParts(collection),
    [collection],
  );
  const activeQueueIndex = playbackQueue.findIndex(
    (item) =>
      (item.cid || null) === (activeEpisode?.cid || null),
  );
  const currentPartTimelineOffset =
    activeQueueIndex > 0
      ? playbackQueue
          .slice(0, activeQueueIndex)
          .reduce((total, item) => total + Math.max(0, item.duration), 0)
      : 0;
  const timelineDuration = playbackQueue.reduce(
    (total, item) => total + Math.max(0, item.duration),
    0,
  );
  const hasVideoParts = playbackQueue.length > 1;
  const videoPartGroups = useMemo(
    () =>
      hasVideoParts
        ? groupCollectionVariants(
            playbackQueue.map((item) => ({
              id: item.key,
              cid: item.cid || 0,
              title: item.title,
              duration: item.duration,
            })),
            language,
          )
        : [],
    [hasVideoParts, language, playbackQueue],
  );
  const playbackQueueByKey = useMemo(
    () => new Map(playbackQueue.map((item) => [item.key, item])),
    [playbackQueue],
  );
  const currentQueueItem =
    activeQueueIndex >= 0 ? playbackQueue[activeQueueIndex] : null;
  const hasCollectionOverview = Boolean(
    collection && hasNavigableCollectionStructure(collection),
  );
  const showCollectionPanel =
    hasCollectionOverview && collectionPanelOpen;

  useEffect(() => {
    try {
      localStorage.setItem(
        "studyflow.collectionPanelOpen",
        String(collectionPanelOpen),
      );
    } catch {
      // Window-local preference is optional.
    }
  }, [collectionPanelOpen]);

  useEffect(() => {
    if (!activeEpisode || videoPartGroups.length === 0) {
      setExpandedVariantGroupIds(new Set());
      return;
    }
    const activeGroup =
      videoPartGroups.find((group) =>
        group.variants.some(
          (variant) => variant.cid === activeEpisode.cid,
        ),
      ) || videoPartGroups[0];
    setExpandedVariantGroupIds(
      new Set([
        `drawer:${activeGroup.key}`,
        `${activeEpisode.id}:${activeGroup.key}`,
      ]),
    );
  }, [activeEpisode, videoPartGroups]);

  useEffect(() => {
    if (!activeEpisode || activeEpisode.variants.length <= 1) return;
    setExpandedEpisodeIds((current) => {
      if (current.has(activeEpisode.id)) return current;
      const next = new Set(current);
      next.add(activeEpisode.id);
      return next;
    });
  }, [activeEpisode?.id]);

  useEffect(() => {
    if (hasVideoParts) setPlayerPlaylistTab("parts");
    else if (collection) setPlayerPlaylistTab("collection");
  }, [activeEpisode?.id, collection, hasVideoParts]);

  const activeVideo = useMemo<ClassifiedVideo>(
    () =>
      activeEpisode
        ? {
            ...video,
            id: `${video.id}-${activeEpisode.id}`,
            bvid: activeEpisode.bvid,
            title: activeEpisode.title,
            cover: activeEpisode.cover || video.cover,
            duration: activeEpisode.duration || video.duration,
          }
        : video,
    [video, activeEpisode],
  );

  useEffect(() => {
    let cancelled = false;
    setCollectionStatus("loading");
    setCollection(null);
    setActiveEpisode(null);
    setExpandedEpisodeIds(new Set());
    if (!window.studyflow || !video.bvid) {
      setCollectionStatus("empty");
      return;
    }
    window.studyflow
      .getVideoCollection(video.bvid)
      .then((result) => {
        if (cancelled) return;
        setCollection(result);
        const navigable = hasNavigableCollectionStructure(result);
        setCollectionStatus(navigable ? "ready" : "empty");
        if (navigable && result) {
          const currentEpisode = result.sections
            .flatMap((item) => item.episodes)
            .find((episode) => episode.bvid === video.bvid);
          if (currentEpisode) {
            const preferredCid =
              learningSession?.items[learningSession.index]?.lesson.cid;
            const preferredVariant = preferredCid
              ? currentEpisode.variants.find(
                  (variant) => variant.cid === preferredCid,
                )
              : null;
            setActiveEpisode(
              preferredVariant
                ? {
                    ...currentEpisode,
                    cid: preferredVariant.cid,
                    duration: preferredVariant.duration,
                  }
                : currentEpisode,
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled) setCollectionStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [video.bvid, learningSession]);

  function getEpisodeProgress(episode: CollectionEpisode) {
    const cids =
      episode.variants.length > 0
        ? episode.variants.map((variant) => variant.cid)
        : episode.cid
          ? [episode.cid]
          : [];
    const progressItems = cids
      .map((cid) => progressByPart[`${episode.bvid}:${cid}`])
      .filter(Boolean);
    if (progressItems.some((progress) => progress.completed)) {
      return { state: "completed" as const, progress: null };
    }
    const latest = progressItems.sort(
      (left, right) => right.updatedAt - left.updatedAt,
    )[0];
    if (latest && latest.currentTime > 5) {
      return { state: "watched" as const, progress: latest };
    }
    return { state: "unwatched" as const, progress: null };
  }

  function selectPlaybackQueueItem(
    item: (typeof playbackQueue)[number],
    options: {
      closePlaylist?: boolean;
      autoPlay?: boolean;
      timelineSeek?: number;
    } = {},
  ) {
    const itemIndex = playbackQueue.findIndex(
      (queueItem) => queueItem.key === item.key,
    );
    const itemOffset =
      itemIndex > 0
        ? playbackQueue
            .slice(0, itemIndex)
            .reduce((total, queueItem) => total + Math.max(0, queueItem.duration), 0)
        : 0;
    setActiveEpisode({
      ...item.episode,
      cid: item.cid,
      duration: item.duration || item.episode.duration,
    });
    setPendingTimelineSeek(options.timelineSeek ?? itemOffset);
    setAutoPlayPart(Boolean(options.autoPlay));
    setPlayerLoadVersion((current) => current + 1);
    if (options.closePlaylist !== false) setPlayerPlaylistOpen(false);
  }

  function playAdjacentQueueItem(direction: -1 | 1) {
    if (activeQueueIndex < 0) return;
    const target = playbackQueue[activeQueueIndex + direction];
    if (!target) return;
    const targetOffset = playbackQueue
      .slice(0, activeQueueIndex + direction)
      .reduce((total, item) => total + Math.max(0, item.duration), 0);
    selectPlaybackQueueItem(target, {
      closePlaylist: false,
      autoPlay: true,
      timelineSeek: targetOffset,
    });
  }

  function handlePlaybackEnded() {
    if (learningSession) {
      onNextLearningLesson();
      return;
    }
    playAdjacentQueueItem(1);
  }

  function openPlayerPlaylist() {
    setPlayerPlaylistTab(hasVideoParts ? "parts" : "collection");
    setPlayerPlaylistOpen(true);
  }

  function seekVideoTimeline(position: number, autoPlay: boolean) {
    const targetPosition = Math.max(0, Math.min(position, timelineDuration - 0.1));
    let elapsed = 0;
    let targetIndex = 0;
    for (let index = 0; index < playbackQueue.length; index += 1) {
      const itemDuration = Math.max(0, playbackQueue[index].duration);
      if (
        targetPosition < elapsed + itemDuration ||
        index === playbackQueue.length - 1
      ) {
        targetIndex = index;
        break;
      }
      elapsed += itemDuration;
    }
    const target = playbackQueue[targetIndex];
    if (!target) return;
    selectPlaybackQueueItem(target, {
      closePlaylist: true,
      autoPlay,
      timelineSeek: targetPosition,
    });
  }

  const playerPlaylistBar =
    collection && hasNavigableCollectionStructure(collection) ? (
      <button
        type="button"
        className={
          playerPlaylistOpen
            ? "player-tool player-overview-tool active"
            : "player-tool player-overview-tool"
        }
        onClick={() =>
          playerPlaylistOpen
            ? setPlayerPlaylistOpen(false)
            : openPlayerPlaylist()
        }
        aria-expanded={playerPlaylistOpen}
        title={
          hasVideoParts
            ? language === "zh"
              ? "展开本视频分P概览"
              : "Open part overview"
            : language === "zh"
              ? "展开合集章节概览"
              : "Open chapter overview"
        }
      >
        <ListVideo size={17} />
        <span>
          {hasVideoParts
            ? `P ${Math.max(0, activeQueueIndex + 1)}/${playbackQueue.length}`
            : `${Math.max(0, activeQueueIndex + 1)}/${playbackQueue.length}`}
        </span>
      </button>
    ) : null;

  return (
    <section className="page video-page">
      <button type="button" className="back-button" onClick={onBack}>
        <ArrowLeft size={17} />
        {translate(language, "back")}
      </button>

      <div
        className={
          showCollectionPanel
            ? "video-layout"
            : "video-layout collection-collapsed"
        }
      >
        <div className="video-main">
          <div className="player-shell">
            <StudyPlayer
              key={`${activeVideo.bvid}-${
                activeEpisode?.cid || "default"
              }-${playerLoadVersion}`}
              video={activeVideo}
              cid={
                activeEpisode?.cid ||
                learningSession?.items[learningSession.index]?.lesson.cid ||
                undefined
              }
              language={language}
              danmakuEnabled={danmakuEnabled}
              volumePreference={volumePreference}
              ratePreference={ratePreference}
              qualityPreference={qualityPreference}
              allowScreenshots
              collectionTitle={
                collection && hasNavigableCollectionStructure(collection)
                  ? collection.title
                  : undefined
              }
              partLabel={
                collection &&
                hasNavigableCollectionStructure(collection) &&
                activeEpisode
                  ? `P${String(activeEpisode.index).padStart(2, "0")}`
                  : undefined
              }
              timelineOffset={currentPartTimelineOffset}
              timelineDuration={timelineDuration}
              initialTimelineSeek={pendingTimelineSeek}
              autoPlay={autoPlayPart}
              playlistOverlay={playerPlaylistBar}
              progressByPart={progressByPart}
              miniPlayerActive={miniPlayerActive}
              segmentPlan={
                learningSession?.items[learningSession.index]?.lesson || null
              }
              onToggleDanmaku={onToggleDanmaku}
              onVolumeChange={onVolumeChange}
              onRateChange={onRateChange}
              onQualityChange={onQualityChange}
              onProgressChange={onProgressChange}
              onWatchTime={onWatchTime}
              onTimelineSeek={seekVideoTimeline}
              onControlsVisibilityChange={setPlayerControlsVisible}
              onToggleMiniPlayer={onToggleMiniPlayer}
              onEnded={handlePlaybackEnded}
            />

            {!collectionPanelOpen &&
              hasCollectionOverview &&
              playerControlsVisible && (
                <button
                  type="button"
                  className="collection-panel-restore"
                  onClick={() => setCollectionPanelOpen(true)}
                  aria-label={
                    language === "zh"
                      ? "展开右侧合集概览"
                      : "Expand course overview"
                  }
                  title={
                    language === "zh"
                      ? "展开合集概览"
                      : "Expand course overview"
                  }
                >
                  <ListVideo size={18} />
                </button>
              )}

            {playerPlaylistOpen && (
              <button
                type="button"
                className="player-playlist-scrim"
                onClick={() => setPlayerPlaylistOpen(false)}
                aria-label={
                  language === "zh" ? "关闭播放列表" : "Close playlist"
                }
              />
            )}
            <aside
              className={
                playerPlaylistOpen
                  ? "player-playlist-drawer open"
                  : "player-playlist-drawer"
              }
              aria-hidden={!playerPlaylistOpen}
              aria-label={
                language === "zh" ? "分P与章节概览" : "Parts and chapters"
              }
            >
              <header className="player-playlist-drawer-head">
                <div>
                  <span className="eyebrow">
                    <span className="eyebrow-dot" />
                    PLAYBACK QUEUE
                  </span>
                  <h3>
                    {language === "zh" ? "分P与章节" : "Parts and chapters"}
                  </h3>
                  <p>
                    {currentQueueItem?.title ||
                      activeEpisode?.title ||
                      collection?.title ||
                      (language === "zh" ? "当前视频" : "Current video")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlayerPlaylistOpen(false)}
                  aria-label={language === "zh" ? "关闭" : "Close"}
                >
                  <X size={16} />
                </button>
              </header>

              {hasVideoParts && (
                <div className="player-playlist-tabs">
                  <button
                    type="button"
                    className={
                      playerPlaylistTab === "parts" ? "active" : ""
                    }
                    onClick={() => setPlayerPlaylistTab("parts")}
                  >
                    {language === "zh"
                      ? `本视频分P · ${playbackQueue.length}`
                      : `Parts · ${playbackQueue.length}`}
                  </button>
                  <button
                    type="button"
                    className={
                      playerPlaylistTab === "collection" ? "active" : ""
                    }
                    onClick={() => setPlayerPlaylistTab("collection")}
                  >
                    {language === "zh"
                      ? `合集章节 · ${collection?.total || 0}`
                      : `Chapters · ${collection?.total || 0}`}
                  </button>
                </div>
              )}

              <div className="player-playlist-drawer-body">
                {playerPlaylistTab === "parts" && hasVideoParts && (
                  <div className="player-playlist-part-groups">
                    {videoPartGroups.map((group) => {
                      const drawerGroupKey = `drawer:${group.key}`;
                      const expanded =
                        expandedVariantGroupIds.has(drawerGroupKey);
                      return (
                        <section
                          className="player-playlist-part-group"
                          key={group.key}
                        >
                          <button
                            type="button"
                            className="player-playlist-group-toggle"
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedVariantGroupIds((current) => {
                                const next = new Set(current);
                                if (next.has(drawerGroupKey)) {
                                  next.delete(drawerGroupKey);
                                } else {
                                  next.add(drawerGroupKey);
                                }
                                return next;
                              })
                            }
                          >
                            <span>
                              {expanded ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                              <strong>{group.label}</strong>
                            </span>
                            <small>
                              {group.variants.length}{" "}
                              {language === "zh" ? "个分P" : "parts"}
                            </small>
                          </button>
                          {expanded && (
                            <div className="player-playlist-items">
                              {group.variants.map((variant) => {
                                const item = playbackQueueByKey.get(
                                  variant.id,
                                );
                                if (!item) return null;
                                const partIndex = playbackQueue.findIndex(
                                  (queueItem) => queueItem.key === item.key,
                                );
                                const active = activeQueueIndex === partIndex;
                                return (
                                  <button
                                    type="button"
                                    key={item.key}
                                    className={active ? "active" : ""}
                                    onClick={() =>
                                      selectPlaybackQueueItem(item)
                                    }
                                  >
                                    <span className="player-playlist-item-index">
                                      P{String(partIndex + 1).padStart(2, "0")}
                                    </span>
                                    <span className="player-playlist-item-copy">
                                      <strong>{variant.title}</strong>
                                      <small>
                                        {formatDuration(
                                          variant.duration,
                                          language,
                                        )}
                                      </small>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}

                {playerPlaylistTab === "collection" && collection && (
                  <div className="player-playlist-collection">
                    {collection.sections.map((section) => (
                      <section key={section.id}>
                        <div className="player-playlist-section-title">
                          <span>{section.title}</span>
                          <small>{section.episodes.length}</small>
                        </div>
                        <div className="player-playlist-items">
                          {section.episodes.map((episode) => {
                            const active = activeEpisode?.id === episode.id;
                            return (
                              <button
                                type="button"
                                key={episode.id}
                                className={active ? "active" : ""}
                                onClick={() =>
                                  selectPlaybackQueueItem({
                                    key: `${episode.id}:${episode.cid || "main"}`,
                                    sectionId: section.id,
                                    sectionTitle: section.title,
                                    episode,
                                    variant: null,
                                    cid: episode.cid,
                                    title: episode.title,
                                    duration: episode.duration,
                                  })
                                }
                              >
                                <span className="player-playlist-item-index">
                                  {String(episode.index).padStart(2, "0")}
                                </span>
                                <span className="player-playlist-item-copy">
                                  <strong>{episode.title}</strong>
                                  <small>
                                    {formatDuration(
                                      episode.duration,
                                      language,
                                    )}
                                    {episode.variants.length > 1
                                      ? language === "zh"
                                        ? ` · ${episode.variants.length} 个分P`
                                        : ` · ${episode.variants.length} parts`
                                      : ""}
                                  </small>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>

          <div className="video-heading">
            <div>
              <div className="video-title-tags">
                <span className={`subject-tag subject-${video.subject}`}>
                  {subjectLabel(language, video.subject)}
                </span>
                {showScores && (
                  <span className="match-pill">
                    <Sparkles size={13} />
                    {Math.round(video.learningScore * 100)}%
                  </span>
                )}
              </div>
              <h1>{activeVideo.title}</h1>
              <p>
                {activeVideo.author} ·{" "}
                {formatCompactNumber(activeVideo.views, language)}{" "}
                {translate(language, "views")} ·{" "}
                {formatDuration(activeVideo.duration, language)}
              </p>
            </div>
            <div className="video-heading-actions">
              <button
                type="button"
                className={saved ? "secondary-button active" : "secondary-button"}
                onClick={() => onSave(activeVideo)}
              >
                <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
                {translate(language, "navLibrary")}
              </button>
              {activeVideo.bvid && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    window.studyflow?.openExternal(
                      `https://www.bilibili.com/video/${activeVideo.bvid}`,
                    )
                  }
                >
                  <ExternalLink size={16} />
                  {translate(language, "openOfficialPage")}
                </button>
              )}
            </div>
          </div>

          <VideoComments
            key={activeVideo.bvid}
            bvid={activeVideo.bvid}
            language={language}
          />

        </div>

        <aside
          className={
            !hasCollectionOverview
              ? "study-panel not-applicable"
              : collectionPanelOpen
                ? "study-panel"
                : "study-panel collapsed"
          }
          aria-hidden={!showCollectionPanel}
        >
          <div className="collection-panel collection-panel-primary">
              <div className="panel-heading">
                <div>
                  <h3>
                    {collection?.title ||
                      (language === "zh" ? "合集目录" : "Course contents")}
                  </h3>
                  <p>
                  {collection
                      ? language === "zh"
                        ? `共 ${collection.total} 个视频${
                            collectionPartCount > collection.total
                              ? ` · ${collectionPartCount} 个分P`
                              : ""
                          }`
                        : `${collection.total} videos${
                            collectionPartCount > collection.total
                              ? ` · ${collectionPartCount} parts`
                              : ""
                          }`
                      : language === "zh"
                        ? "正在读取系列信息"
                        : "Loading course information"}
                  </p>
                </div>
                <div className="collection-panel-heading-actions">
                  <button
                    type="button"
                    className="collection-panel-collapse"
                    onClick={() => setCollectionPanelOpen(false)}
                    aria-label={
                      language === "zh"
                        ? "收起右侧合集概览"
                        : "Collapse course overview"
                    }
                    title={
                      language === "zh"
                        ? "收起合集概览"
                        : "Collapse course overview"
                    }
                  >
                    <ListVideo size={19} />
                  </button>
                </div>
              </div>

              {collectionStatus === "loading" && (
                <div className="collection-state">
                  <LoaderCircle className="spin" size={19} />
                  {language === "zh" ? "正在读取合集" : "Loading series"}
                </div>
              )}

              {collectionStatus === "empty" && (
                <div className="collection-state">
                  <ListVideo size={23} />
                  <strong>
                    {language === "zh" ? "这是一个单集视频" : "This is a single video"}
                  </strong>
                  <span>
                    {language === "zh"
                      ? "没有检测到多 P 分集或课程合集。"
                      : "No multi-part course or UGC season was found."}
                  </span>
                </div>
              )}

              {collectionStatus === "error" && (
                <div className="collection-state">
                  <LockKeyhole size={21} />
                  <strong>
                    {language === "zh" ? "合集读取失败" : "Unable to load series"}
                  </strong>
                  <span>
                    {language === "zh"
                      ? "请登录后刷新当前视频。"
                      : "Sign in and reload this video."}
                  </span>
                </div>
              )}

              {collectionStatus === "ready" && collection && (
                <div className="collection-sections">
                  {collection.sections.map((section) => (
                    <section key={section.id}>
                      <div className="collection-section-title">
                        <span>{section.title}</span>
                        <span>{section.episodes.length}</span>
                      </div>
                      <div className="episode-list">
                        {section.episodes.map((episode) => {
                          const isActive =
                            activeEpisode?.id === episode.id;
                          const episodeProgress = getEpisodeProgress(episode);
                          const episodeExpanded =
                            expandedEpisodeIds.has(episode.id);
                          const episodeVariantGroups =
                            episode.variants.length > 8
                              ? groupCollectionVariants(
                                  episode.variants,
                                  language,
                                )
                              : [];
                          return (
                            <div
                              key={`${section.id}-${episode.id}`}
                              className={
                                isActive ? "episode-entry active" : "episode-entry"
                              }
                            >
                              <button
                                type="button"
                                className={
                                  isActive ? "episode-row active" : "episode-row"
                                }
                                onClick={() => {
                                  setActiveEpisode(episode);
                                  if (episode.variants.length > 1) {
                                    setExpandedEpisodeIds((current) => {
                                      const next = new Set(current);
                                      if (next.has(episode.id)) {
                                        next.delete(episode.id);
                                      } else {
                                        next.add(episode.id);
                                      }
                                      return next;
                                    });
                                  }
                                }}
                              >
                                <span className="episode-index">
                                  {String(episode.index).padStart(2, "0")}
                                </span>
                                <span className="episode-copy">
                                  <strong>{episode.title}</strong>
                                  <small>
                                    {formatDuration(episode.duration, language)}
                                    {episode.variants.length > 1
                                      ? language === "zh"
                                        ? ` · ${episode.variants.length} 个分P`
                                        : ` · ${episode.variants.length} parts`
                                      : ""}
                                  </small>
                                </span>
                                <span
                                  className={`episode-state ${episodeProgress.state}`}
                                >
                                  {isActive
                                    ? language === "zh"
                                      ? "当前分P"
                                      : "Current"
                                    : episodeProgress.state === "completed"
                                      ? language === "zh"
                                        ? "已看完"
                                        : "Watched"
                                      : episodeProgress.state === "watched"
                                        ? formatDuration(
                                            episodeProgress.progress?.currentTime ||
                                              0,
                                            language,
                                          )
                                        : language === "zh"
                                          ? "未观看"
                                          : "Unwatched"}
                                </span>
                                {episode.variants.length > 1 && (
                                  <span className="episode-expand-icon">
                                    {episodeExpanded ? (
                                      <ChevronDown size={14} />
                                    ) : (
                                      <ChevronRight size={14} />
                                    )}
                                  </span>
                                )}
                              </button>
                              {episodeExpanded &&
                                episode.variants.length > 8 && (
                                  <div className="episode-variant-groups">
                                    {episodeVariantGroups.map((group) => {
                                      const groupStateKey = `${episode.id}:${group.key}`;
                                      const groupExpanded =
                                        expandedVariantGroupIds.has(groupStateKey);
                                      return (
                                        <section
                                          className="episode-variant-group"
                                          key={group.key}
                                        >
                                          <button
                                            type="button"
                                            className="episode-variant-group-toggle"
                                            aria-expanded={groupExpanded}
                                            onClick={() =>
                                              setExpandedVariantGroupIds(
                                                (current) => {
                                                  const next = new Set(
                                                    current,
                                                  );
                                                  if (next.has(groupStateKey)) {
                                                    next.delete(groupStateKey);
                                                  } else {
                                                    next.add(groupStateKey);
                                                  }
                                                  return next;
                                                },
                                              )
                                            }
                                          >
                                            <span>
                                              {groupExpanded ? (
                                                <ChevronDown size={13} />
                                              ) : (
                                                <ChevronRight size={13} />
                                              )}
                                              <strong>{group.label}</strong>
                                            </span>
                                            <small>
                                              {group.variants.length}{" "}
                                              {language === "zh"
                                                ? "个分P"
                                                : "parts"}
                                            </small>
                                          </button>
                                          {groupExpanded && (
                                            <div className="episode-variant-grid">
                                              {group.variants.map((variant) => (
                                                <button
                                                  type="button"
                                                  key={variant.id}
                                                  className={
                                                    isActive &&
                                                    activeEpisode?.cid ===
                                                      variant.cid
                                                      ? "active"
                                                      : ""
                                                  }
                                                  onClick={() => {
                                                    setActiveEpisode({
                                                      ...episode,
                                                      cid: variant.cid,
                                                      duration:
                                                        variant.duration,
                                                    });
                                                  }}
                                                >
                                                  <span>
                                                    {variant.title}
                                                  </span>
                                                  <small>
                                                    {formatDuration(
                                                      variant.duration,
                                                      language,
                                                    )}
                                                  </small>
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </section>
                                      );
                                    })}
                                  </div>
                                )}

                              {episodeExpanded &&
                                episode.variants.length > 1 &&
                                episode.variants.length <= 8 && (
                                <div className="episode-variants">
                                  {episode.variants.map((variant) => (
                                    <button
                                      type="button"
                                      key={variant.id}
                                      className={
                                        isActive &&
                                        activeEpisode?.cid === variant.cid
                                          ? "active"
                                          : ""
                                      }
                                      onClick={() => {
                                        setActiveEpisode({
                                          ...episode,
                                          cid: variant.cid,
                                          duration: variant.duration,
                                        });
                                      }}
                                    >
                                      <span>{variant.title}</span>
                                      <small>
                                        {formatDuration(
                                          variant.duration,
                                          language,
                                        )}
                                      </small>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
          </div>
        </aside>
      </div>

      <CourseNotes
        language={language}
        notesKey={
          collection && hasNavigableCollectionStructure(collection)
            ? `collection:${collection.id}`
            : `video:${activeVideo.bvid}`
        }
        title={
          collection && hasNavigableCollectionStructure(collection)
            ? collection.title
            : activeVideo.title
        }
      />

      <div className="related-section">
        <div className="section-heading">
          <h2>{translate(language, "upNext")}</h2>
          <span>{related.length}</span>
        </div>
        <div className="related-grid">
          {related.map((item) => (
            <VideoCard
              compact
              key={item.id}
              video={item}
              language={language}
              showScore={showScores}
              saved={savedSet.has(videoKey(item))}
              onOpen={onOpen}
              onSave={onSave}
              onFeedback={onFeedback}
              onBlockAuthor={onBlockAuthor}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
