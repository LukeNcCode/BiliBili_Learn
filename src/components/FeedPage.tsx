import {
  BrainCircuit,
  BookOpenCheck,
  ChevronRight,
  Filter,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { SemanticStatus } from "../lib/localSemantic";
import type {
  ClassifiedVideo,
  Language,
  LearningMode,
  SubjectKey,
} from "../types";
import { modeLabel, subjectLabel, translate } from "../i18n";
import { VideoCard } from "./VideoCard";
import { videoKey } from "../lib/videoKey";

interface FeedPageProps {
  language: Language;
  mode: LearningMode;
  allVideos: ClassifiedVideo[];
  visibleVideos: ClassifiedVideo[];
  rawCount: number;
  historyCount: number;
  selectedSubject: SubjectKey | "all";
  enabledSubjects: SubjectKey[];
  loading: boolean;
  liveSource: boolean;
  warning: string;
  saved: Set<string>;
  showScores: boolean;
  semanticStatus: SemanticStatus;
  onSelectSubject: (subject: SubjectKey | "all") => void;
  onSetMode: (mode: LearningMode) => void;
  onRefresh: () => void;
  onOpen: (video: ClassifiedVideo) => void;
  onSave: (video: ClassifiedVideo) => void;
  onFeedback: (video: ClassifiedVideo, value: number) => void;
  onBlockAuthor: (author: string) => void;
}

export function FeedPage({
  language,
  mode,
  allVideos,
  visibleVideos,
  rawCount,
  historyCount,
  selectedSubject,
  enabledSubjects,
  loading,
  liveSource,
  warning,
  saved,
  showScores,
  semanticStatus,
  onSelectSubject,
  onSetMode,
  onRefresh,
  onOpen,
  onSave,
  onFeedback,
  onBlockAuthor,
}: FeedPageProps) {
  const filteredCount = Math.max(0, rawCount - visibleVideos.length);
  const subjects: (SubjectKey | "all")[] = ["all", ...enabledSubjects];

  return (
    <section className="page feed-page youtube-feed">
      <div className="learning-page-head">
        <div>
          <h1>
            {language === "zh" ? "学习推荐" : "Learning recommendations"}
          </h1>
          <p>
            {language === "zh"
              ? "从 B 站候选内容中保留课程、知识讲解和技能训练。"
              : "Courses, explainers and skill-building videos kept from Bilibili candidates."}
          </p>
        </div>
        <div className="learning-summary">
          <span>
            <strong>{visibleVideos.length}</strong>
            {language === "zh" ? "学习视频" : "videos"}
          </span>
          <span>
            <strong>{saved.size}</strong>
            {language === "zh" ? "已收藏" : "saved"}
          </span>
          <span>
            <strong>{historyCount}</strong>
            {language === "zh" ? "最近打开" : "recent"}
          </span>
        </div>
      </div>

      <div className="feed-toolbar chip-row">
        <div className="subject-tabs" role="tablist">
          {subjects.map((subject) => (
            <button
              type="button"
              role="tab"
              aria-selected={selectedSubject === subject}
              className={selectedSubject === subject ? "subject-tab active" : "subject-tab"}
              key={subject}
              onClick={() => onSelectSubject(subject)}
            >
              {subject === "all"
                ? translate(language, "all")
                : subjectLabel(language, subject)}
            </button>
          ))}
        </div>

        <div className="toolbar-actions">
          <span className="live-source-label">
            <span className={liveSource ? "source-dot live" : "source-dot"} />
            {liveSource
              ? translate(language, "sourceLive")
              : translate(language, "demoSource")}
          </span>
          {semanticStatus !== "idle" && (
            <span
              className="semantic-source-label"
              data-status={semanticStatus}
              title={
                semanticStatus === "error"
                  ? language === "zh"
                    ? "本地语义模型加载失败，当前使用关键词和词频规则。"
                    : "The local model could not load. Keyword and term-frequency rules remain active."
                  : undefined
              }
            >
              <BrainCircuit size={13} />
              {translate(
                language,
                semanticStatus === "loading"
                  ? "semanticLoading"
                  : semanticStatus === "ready"
                    ? "semanticReady"
                    : "semanticFallback",
              )}
            </span>
          )}
          <div className="mode-switch" aria-label={translate(language, "learningMode")}>
            {(["focus", "balanced", "explore"] as LearningMode[]).map((item) => (
              <button
                type="button"
                key={item}
                className={mode === item ? "active" : ""}
                onClick={() => onSetMode(item)}
              >
                {modeLabel(language, item)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-button refresh-button"
            onClick={onRefresh}
            disabled={loading}
            title={translate(language, "refresh")}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {warning && (
        <div className="status-banner">
          <Sparkles size={15} />
          <span>
            {translate(
              language,
              warning === "supplement"
                ? "supplementedCandidates"
                : "loadFallback",
            )}
          </span>
        </div>
      )}

      <div className="feed-stats quiet-stats">
        <span>
          <Filter size={14} />
          {rawCount || allVideos.length} {translate(language, "candidates")}
        </span>
        <span className="stat-divider" />
        <span className="positive">
          <BookOpenCheck size={14} />
          {visibleVideos.length} {translate(language, "retained")}
        </span>
        <span className="stat-divider" />
        <span>{filteredCount} {translate(language, "filtered")}</span>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loader-orbit">
            <span />
            <span />
            <span />
          </div>
          <p>{translate(language, "loading")}</p>
        </div>
      ) : visibleVideos.length > 0 ? (
        <div className="video-grid">
          {visibleVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              language={language}
              showScore={showScores}
              saved={saved.has(videoKey(video))}
              onOpen={onOpen}
              onSave={onSave}
              onFeedback={onFeedback}
              onBlockAuthor={onBlockAuthor}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <BookOpenCheck size={30} />
          </div>
          <h2>{translate(language, "empty")}</h2>
          <p>{translate(language, "emptyHelp")}</p>
          <button type="button" className="primary-button" onClick={() => onSelectSubject("all")}>
            {translate(language, "all")}
            <ChevronRight size={16} />
          </button>
        </div>
      )}

    </section>
  );
}
