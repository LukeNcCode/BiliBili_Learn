import {
  Bookmark,
  CirclePlay,
  MoreHorizontal,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { ClassifiedVideo, Language } from "../types";
import {
  formatCompactNumber,
  formatDuration,
  formatRelativeDate,
} from "../lib/format";
import { scoreLabel } from "../lib/classifier";
import { subjectLabel, translate } from "../i18n";
import { CoverArt } from "./CoverArt";

interface VideoCardProps {
  video: ClassifiedVideo;
  language: Language;
  showScore: boolean;
  saved: boolean;
  compact?: boolean;
  onOpen: (video: ClassifiedVideo) => void;
  onSave: (video: ClassifiedVideo) => void;
  onFeedback: (video: ClassifiedVideo, value: number) => void;
  onBlockAuthor: (author: string) => void;
}

export function VideoCard({
  video,
  language,
  showScore,
  saved,
  compact = false,
  onOpen,
  onSave,
  onFeedback,
  onBlockAuthor,
}: VideoCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarColor = Array.from(video.author || "S").reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  ) % 360;

  return (
    <article className={compact ? "video-card compact" : "video-card"}>
      <button
        type="button"
        className="video-cover"
        onClick={() => onOpen(video)}
        aria-label={`${translate(language, "watchNow")}: ${video.title}`}
      >
        <CoverArt cover={video.cover} title={video.title} subject={video.subject} />
        <span className="cover-shade" />
        <span className="duration-badge">
          {formatDuration(video.duration, language)}
        </span>
        {showScore && (
          <span className="score-badge">
            {Math.round(video.learningScore * 100)}%
          </span>
        )}
        <span className="play-hover">
          <CirclePlay size={43} strokeWidth={1.4} />
        </span>
      </button>

      <div className="video-card-body">
        <div className="video-copy">
          <button
            type="button"
            className="video-title"
            onClick={() => onOpen(video)}
          >
            {video.title}
          </button>
          <div className="video-meta">
            <span
              className="creator-avatar"
              style={{ "--avatar-hue": avatarColor } as CSSProperties}
            >
              {video.authorAvatar ? (
                <img
                  src={video.authorAvatar}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                (video.author || "S").slice(0, 1).toUpperCase()
              )}
            </span>
            <span>{video.author}</span>
            <span className="dot-separator" />
            <span>
              {formatCompactNumber(video.views, language)}{" "}
              {translate(language, "views")}
            </span>
          </div>
          <div className="video-meta secondary-meta">
            <span>{formatRelativeDate(video.publishedAt, language)}</span>
            <span className="dot-separator" />
            <span>{subjectLabel(language, video.subject)}</span>
          </div>
          {showScore && (
            <div className="reason-row">
              <span>
                {video.reasons[0]
                  ? translate(language, video.reasons[0] as never)
                  : scoreLabel(video.learningScore, language)}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="video-menu-button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label={translate(language, "recommendReason")}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {menuOpen && (
        <div className="card-menu" onMouseLeave={() => setMenuOpen(false)}>
          <button
            type="button"
            onClick={() => {
              onFeedback(video, 1);
              setMenuOpen(false);
            }}
          >
            <ThumbsUp size={16} />
            {translate(language, "useful")}
          </button>
          <button
            type="button"
            onClick={() => {
              onFeedback(video, -1);
              setMenuOpen(false);
            }}
          >
            <ThumbsDown size={16} />
            {translate(language, "notUseful")}
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(video);
              setMenuOpen(false);
            }}
          >
            <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
            {translate(language, "navLibrary")}
          </button>
          <button
            type="button"
            className="danger-action"
            onClick={() => {
              onBlockAuthor(video.author);
              setMenuOpen(false);
            }}
          >
            <X size={16} />
            {translate(language, "blockAuthor")}
          </button>
        </div>
      )}
    </article>
  );
}
