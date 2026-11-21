import { Bookmark, Clock3 } from "lucide-react";
import type {
  ClassifiedVideo,
  Language,
  StudyHistory,
} from "../types";
import { translate } from "../i18n";
import { formatRelativeDate } from "../lib/format";
import { CoverArt } from "./CoverArt";
import { VideoCard } from "./VideoCard";
import { videoKey } from "../lib/videoKey";

interface CollectionPageProps {
  kind: "library" | "history";
  language: Language;
  savedVideos: ClassifiedVideo[];
  history: StudyHistory[];
  saved: Set<string>;
  showScores: boolean;
  onOpen: (video: ClassifiedVideo) => void;
  onSave: (video: ClassifiedVideo) => void;
  onFeedback: (video: ClassifiedVideo, value: number) => void;
  onBlockAuthor: (author: string) => void;
  onOpenHistory: (entry: StudyHistory) => void;
}

export function CollectionPage({
  kind,
  language,
  savedVideos,
  history,
  saved,
  showScores,
  onOpen,
  onSave,
  onFeedback,
  onBlockAuthor,
  onOpenHistory,
}: CollectionPageProps) {
  const isLibrary = kind === "library";

  return (
    <section className="page collection-page">
      <div className="page-heading">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          {isLibrary ? "LIBRARY / 03" : "RECENT / 04"}
        </div>
        <h1>
          {translate(language, isLibrary ? "navLibrary" : "navHistory")}
        </h1>
        <p>
          {translate(
            language,
            isLibrary ? "libraryHelp" : "historyHelp",
          )}
        </p>
      </div>

      {isLibrary && savedVideos.length > 0 && (
        <div className="video-grid">
          {savedVideos.map((video) => (
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
      )}

      {isLibrary && savedVideos.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <Bookmark size={29} />
          </div>
          <h2>{translate(language, "libraryEmpty")}</h2>
          <p>{translate(language, "libraryHelp")}</p>
        </div>
      )}

      {!isLibrary && history.length > 0 && (
        <div className="history-list">
          {history.map((entry, index) => (
            <button
              type="button"
              className="history-row"
              key={`${entry.bvid}-${entry.watchedAt}`}
              onClick={() => onOpenHistory(entry)}
            >
              <span className="history-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="history-cover">
                <CoverArt
                  cover={entry.cover}
                  title={entry.title}
                  subject={entry.subject}
                />
              </span>
              <span className="history-copy">
                <strong>{entry.title}</strong>
                <span>{entry.author}</span>
              </span>
              <span className="history-time">
                <Clock3 size={14} />
                {formatRelativeDate(entry.watchedAt, language)}
              </span>
            </button>
          ))}
        </div>
      )}

      {!isLibrary && history.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <Clock3 size={29} />
          </div>
          <h2>{translate(language, "historyEmpty")}</h2>
          <p>{translate(language, "historyHelp")}</p>
        </div>
      )}
    </section>
  );
}
