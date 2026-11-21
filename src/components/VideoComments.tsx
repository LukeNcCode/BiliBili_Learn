import {
  ChevronDown,
  ChevronUp,
  Flame,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatCompactNumber, formatRelativeDate } from "../lib/format";
import type {
  Language,
  VideoComment,
  VideoReplyPage,
} from "../types";

interface VideoCommentsProps {
  bvid: string;
  language: Language;
}

interface ReplyState extends VideoReplyPage {
  loading: boolean;
  error: string;
}

const fallbackEmojis: Record<string, string> = {
  "[微笑]": "🙂",
  "[大笑]": "😄",
  "[笑哭]": "😂",
  "[委屈]": "🥺",
  "[大哭]": "😭",
  "[保佑]": "🙏",
  "[doge]": "🐶",
  "[热词系列_知识增加]": "🤔",
  "[OK]": "👌",
  "[喜欢]": "👍",
  "[妙啊]": "👏",
};

function CommentContent({
  text,
  emojis,
}: {
  text: string;
  emojis: Record<string, string>;
}) {
  return (
    <>
      {text.split(/(\[[^\]]{1,32}\])/g).map((part, index) => {
        const imageUrl = emojis[part];
        if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
          return (
            <img
              className="comment-emoji"
              key={`${index}-${part}`}
              src={imageUrl}
              alt={part}
              title={part}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          );
        }
        if (fallbackEmojis[part]) {
          return (
            <span className="comment-unicode-emoji" key={`${index}-${part}`}>
              {fallbackEmojis[part]}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

export function VideoComments({ bvid, language }: VideoCommentsProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(
    new Set(),
  );
  const [replyStates, setReplyStates] = useState<Record<string, ReplyState>>(
    {},
  );
  const [commentsExpanded, setCommentsExpanded] = useState(true);

  useEffect(() => {
    setComments([]);
    setPage(0);
    setTotal(0);
    setHasMore(false);
    setError("");
    setExpandedReplies(new Set());
    setReplyStates({});
    setCommentsExpanded(true);
  }, [bvid]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "360px 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || !bvid || !window.studyflow) return;
    let active = true;
    setLoading(true);
    setError("");
    window.studyflow
      .getVideoComments(bvid, 1, 20)
      .then((result) => {
        if (!active) return;
        setComments(result.comments);
        setPage(result.page);
        setTotal(result.total);
        setHasMore(result.hasMore);
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : language === "zh"
                ? "评论加载失败"
                : "Unable to load comments",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bvid, language, nearViewport, reloadToken]);

  async function loadMoreComments() {
    if (!window.studyflow || loading || !hasMore) return;
    setLoading(true);
    setError("");
    try {
      const result = await window.studyflow.getVideoComments(
        bvid,
        page + 1,
        20,
      );
      setComments((current) => {
        const seen = new Set(current.map((comment) => comment.id));
        return [
          ...current,
          ...result.comments.filter((comment) => !seen.has(comment.id)),
        ];
      });
      setPage(result.page);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : language === "zh"
            ? "更多评论加载失败"
            : "Unable to load more comments",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadReplies(comment: VideoComment, nextPage: number) {
    if (!window.studyflow) return;
    const existing = replyStates[comment.id];
    if (existing?.loading) return;
    setReplyStates((current) => ({
      ...current,
      [comment.id]: {
        replies: existing?.replies || [],
        page: existing?.page || 0,
        total: existing?.total || comment.replyCount,
        hasMore: existing?.hasMore || false,
        loading: true,
        error: "",
      },
    }));
    setExpandedReplies((current) => new Set(current).add(comment.id));
    try {
      const result = await window.studyflow.getCommentReplies(
        bvid,
        comment.id,
        nextPage,
      );
      setReplyStates((current) => {
        const previous = current[comment.id];
        const previousReplies = nextPage > 1 ? previous?.replies || [] : [];
        const seen = new Set(previousReplies.map((reply) => reply.id));
        return {
          ...current,
          [comment.id]: {
            ...result,
            replies: [
              ...previousReplies,
              ...result.replies.filter((reply) => !seen.has(reply.id)),
            ],
            loading: false,
            error: "",
          },
        };
      });
      setExpandedReplies((current) => new Set(current).add(comment.id));
    } catch (reason) {
      setReplyStates((current) => ({
        ...current,
        [comment.id]: {
          replies: current[comment.id]?.replies || [],
          page: current[comment.id]?.page || 0,
          total: current[comment.id]?.total || comment.replyCount,
          hasMore: current[comment.id]?.hasMore || false,
          loading: false,
          error:
            reason instanceof Error
              ? reason.message
              : language === "zh"
                ? "回复加载失败"
                : "Unable to load replies",
        },
      }));
    }
  }

  function toggleReplies(comment: VideoComment) {
    if (expandedReplies.has(comment.id)) {
      setExpandedReplies((current) => {
        const next = new Set(current);
        next.delete(comment.id);
        return next;
      });
      return;
    }
    if (replyStates[comment.id]?.page) {
      setExpandedReplies((current) => new Set(current).add(comment.id));
      return;
    }
    void loadReplies(comment, 1);
  }

  if (!bvid) return null;

  return (
    <section className="video-comments" ref={sectionRef}>
      <div className="comments-heading">
        <div>
          <span className="eyebrow">
            <MessageCircle size={14} />
            {language === "zh" ? "评论区" : "Comments"}
          </span>
          <h2>
            {language === "zh" ? "热门评论" : "Top comments"}
            {total > 0 && <small>{formatCompactNumber(total, language)}</small>}
          </h2>
        </div>
        <div className="comments-heading-actions">
          <span className="hot-comments-sort">
            <Flame size={14} />
            {language === "zh" ? "按热度排序" : "Sorted by popularity"}
          </span>
          <button
            type="button"
            className="comments-collapse-toggle"
            onClick={() => setCommentsExpanded((current) => !current)}
            aria-expanded={commentsExpanded}
          >
            {commentsExpanded ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
            {language === "zh"
              ? commentsExpanded
                ? "收起评论"
                : "展开评论"
              : commentsExpanded
                ? "Collapse"
                : "Expand"}
          </button>
        </div>
      </div>

      {!commentsExpanded ? null : !nearViewport ||
        (loading && comments.length === 0) ? (
        <div className="comments-state">
          <LoaderCircle className="spin" size={20} />
          {language === "zh" ? "正在加载评论" : "Loading comments"}
        </div>
      ) : error && comments.length === 0 ? (
        <div className="comments-state error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadToken((current) => current + 1)}
          >
            <RefreshCw size={14} />
            {language === "zh" ? "重试" : "Retry"}
          </button>
        </div>
      ) : comments.length === 0 ? (
        <div className="comments-state">
          <MessageCircle size={21} />
          {language === "zh" ? "暂时没有热门评论" : "No comments yet"}
        </div>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => {
            const repliesOpen = expandedReplies.has(comment.id);
            const replyState = replyStates[comment.id];
            return (
              <article className="comment-item" key={comment.id}>
                <span className="comment-avatar">
                  {comment.avatar ? (
                    <img
                      src={comment.avatar}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    (comment.author || "?").slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="comment-main">
                  <div className="comment-meta">
                    <strong>{comment.author}</strong>
                    {comment.createdAt > 0 && (
                      <span>
                        {formatRelativeDate(comment.createdAt, language)}
                      </span>
                    )}
                  </div>
                  <p>
                    <CommentContent
                      text={comment.content}
                      emojis={comment.emojis || {}}
                    />
                  </p>
                  <div className="comment-actions">
                    <span title={language === "zh" ? "点赞数" : "Likes"}>
                      <ThumbsUp size={13} />
                      {formatCompactNumber(comment.likeCount, language)}
                    </span>
                    {comment.replyCount > 0 && (
                      <button type="button" onClick={() => toggleReplies(comment)}>
                        {repliesOpen ? (
                          <ChevronUp size={13} />
                        ) : (
                          <ChevronDown size={13} />
                        )}
                        {language === "zh"
                          ? `${comment.replyCount} 条回复`
                          : `${comment.replyCount} replies`}
                      </button>
                    )}
                  </div>

                  {repliesOpen && replyState && (
                    <div className="comment-replies">
                      {replyState.replies.map((reply) => (
                        <div className="comment-reply" key={reply.id}>
                          <span className="comment-avatar small">
                            {reply.avatar ? (
                              <img
                                src={reply.avatar}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              (reply.author || "?").slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <div>
                            <div className="comment-meta">
                              <strong>{reply.author}</strong>
                              {reply.createdAt > 0 && (
                                <span>
                                  {formatRelativeDate(
                                    reply.createdAt,
                                    language,
                                  )}
                                </span>
                              )}
                            </div>
                            <p>
                              <CommentContent
                                text={reply.content}
                                emojis={reply.emojis || {}}
                              />
                            </p>
                            <span className="reply-like-count">
                              <ThumbsUp size={12} />
                              {formatCompactNumber(reply.likeCount, language)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {replyState.loading && (
                        <span className="reply-loading">
                          <LoaderCircle className="spin" size={14} />
                          {language === "zh"
                            ? "正在加载回复"
                            : "Loading replies"}
                        </span>
                      )}
                      {replyState.error && (
                        <span className="reply-error">{replyState.error}</span>
                      )}
                      {replyState.hasMore && !replyState.loading && (
                        <button
                          type="button"
                          className="load-more-replies"
                          onClick={() =>
                            void loadReplies(comment, replyState.page + 1)
                          }
                        >
                          {language === "zh"
                            ? "加载更多回复"
                            : "Load more replies"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {(hasMore || error) && (
            <button
              type="button"
              className="load-more-comments"
              onClick={() => void loadMoreComments()}
              disabled={loading}
            >
              {loading ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <ChevronDown size={15} />
              )}
              {language === "zh" ? "加载更多评论" : "Load more comments"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
