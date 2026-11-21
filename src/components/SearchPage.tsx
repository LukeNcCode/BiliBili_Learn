import { FormEvent, useState } from "react";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import type { ClassifiedVideo, Language } from "../types";
import { translate } from "../i18n";
import { VideoCard } from "./VideoCard";
import { videoKey } from "../lib/videoKey";

interface SearchPageProps {
  language: Language;
  initialQuery: string;
  videos: ClassifiedVideo[];
  loading: boolean;
  searched: boolean;
  saved: Set<string>;
  showScores: boolean;
  onSearch: (query: string) => void;
  onOpen: (video: ClassifiedVideo) => void;
  onSave: (video: ClassifiedVideo) => void;
  onFeedback: (video: ClassifiedVideo, value: number) => void;
  onBlockAuthor: (author: string) => void;
}

const suggestions = {
  zh: ["Python 数据分析", "线性代数", "英语口语", "产品经理", "机器学习"],
  en: ["Python tutorial", "linear algebra", "English speaking", "product management", "machine learning"],
};

export function SearchPage({
  language,
  initialQuery,
  videos,
  loading,
  searched,
  saved,
  showScores,
  onSearch,
  onOpen,
  onSave,
  onFeedback,
  onBlockAuthor,
}: SearchPageProps) {
  const [query, setQuery] = useState(initialQuery);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) onSearch(query.trim());
  }

  return (
    <section className="page search-page">
      <div className="page-heading">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          SEARCH / 02
        </div>
        <h1>{translate(language, "searchTitle")}</h1>
        <p>{translate(language, "searchHelp")}</p>
      </div>

      <form className="search-hero" onSubmit={submit}>
        <Search size={22} />
        <input
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder={translate(language, "searchPlaceholder")}
        />
        <button type="submit" className="primary-button">
          {translate(language, "searchButton")}
          <ArrowRight size={17} />
        </button>
      </form>

      {!searched && (
        <div className="suggestions">
          <span>
            <Sparkles size={15} />
            {language === "zh" ? "试试这些学习主题" : "Try a learning topic"}
          </span>
          <div>
            {suggestions[language].map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                  onSearch(suggestion);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state compact-loading">
          <div className="loader-orbit">
            <span />
            <span />
            <span />
          </div>
          <p>{translate(language, "loading")}</p>
        </div>
      ) : videos.length > 0 ? (
        <>
          <div className="results-heading">
            <span>{videos.length} {translate(language, "results")}</span>
            <span>“{initialQuery}”</span>
          </div>
          <div className="video-grid search-grid">
            {videos.map((video) => (
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
        </>
      ) : searched ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Search size={28} />
          </div>
          <h2>{translate(language, "searchNoResults")}</h2>
          <p>{translate(language, "emptyHelp")}</p>
        </div>
      ) : (
        <div className="empty-state subdued-empty">
          <div className="empty-icon">
            <Search size={28} />
          </div>
          <h2>{translate(language, "searchEmpty")}</h2>
        </div>
      )}
    </section>
  );
}
