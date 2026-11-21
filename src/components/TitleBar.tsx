import { FormEvent, useState } from "react";
import {
  Languages,
  Maximize2,
  Minus,
  Moon,
  Search,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import type { Language, LoginState, ThemeMode } from "../types";
import { translate } from "../i18n";

interface TitleBarProps {
  language: Language;
  loginState: LoginState;
  creatorMode: boolean;
  theme: ThemeMode;
  onHome: () => void;
  onToggleMode: () => void;
  onToggleTheme: () => void;
  onLogin: () => void;
  onSearch: (query: string) => void;
  onToggleLanguage: () => void;
}

export function TitleBar({
  language,
  loginState,
  creatorMode,
  theme,
  onHome,
  onToggleMode,
  onToggleTheme,
  onLogin,
  onSearch,
  onToggleLanguage,
}: TitleBarProps) {
  const [query, setQuery] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) onSearch(query.trim());
  }

  return (
    <header className={creatorMode ? "titlebar creator-titlebar" : "titlebar"}>
      <button
        className="brand drag-disabled"
        type="button"
        onClick={onHome}
        aria-label={translate(language, "appName")}
      >
        <span className="brand-mark">
          <span className="brand-play" />
        </span>
        <span className="brand-copy">
          <span className="brand-name">BiliBili</span>
          <span className="brand-edition">Learning Version</span>
        </span>
      </button>

      <div className="search-cluster">
        <form className="global-search" onSubmit={submit}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              creatorMode
                ? language === "zh"
                  ? "搜索全部 B 站视频并加入学习清单"
                  : "Search all Bilibili videos for your learning list"
                : translate(language, "searchPlaceholder")
            }
            aria-label={
              creatorMode
                ? language === "zh"
                  ? "搜索全部 B 站视频"
                  : "Search all Bilibili videos"
                : translate(language, "searchPlaceholder")
            }
          />
          <button type="submit" aria-label={translate(language, "searchTitle")}>
            <Search size={19} strokeWidth={1.9} />
          </button>
        </form>
      </div>

      <div className="header-actions">
        <div
          className="workspace-mode-switch"
          data-mode={creatorMode ? "creator" : "learn"}
          role="group"
        >
          <button
            type="button"
            className={!creatorMode ? "active" : ""}
            onClick={() => {
              if (creatorMode) onToggleMode();
            }}
          >
            {language === "zh" ? "学习" : "Learn"}
          </button>
          <button
            type="button"
            className={creatorMode ? "active" : ""}
            onClick={() => {
              if (!creatorMode) onToggleMode();
            }}
          >
            {language === "zh" ? "制作" : "Create"}
          </button>
        </div>
        <button
          type="button"
          className={`theme-toggle ${theme}`}
          onClick={onToggleTheme}
          title={
            theme === "dark"
              ? language === "zh"
                ? "切换到浅色主题"
                : "Switch to light theme"
              : language === "zh"
                ? "切换到深色主题"
                : "Switch to dark theme"
          }
          aria-label={
            theme === "dark"
              ? language === "zh"
                ? "切换到浅色主题"
                : "Switch to light theme"
              : language === "zh"
                ? "切换到深色主题"
                : "Switch to dark theme"
          }
          aria-pressed={theme === "light"}
        >
          <span className="theme-toggle-track">
            <Moon className="theme-toggle-moon" size={11} />
            <Sun className="theme-toggle-sun" size={11} />
            <span className="theme-toggle-thumb" />
          </span>
        </button>
        <button
          className="titlebar-tool language-tool"
          type="button"
          onClick={onToggleLanguage}
          title={translate(language, "language")}
        >
          <Languages size={16} />
          <span>{language === "zh" ? "EN" : "中"}</span>
        </button>
        <button
          className={loginState.loggedIn ? "account-button connected" : "account-button"}
          type="button"
          onClick={onLogin}
        >
          {loginState.loggedIn && loginState.avatarUrl ? (
            <img
              className="account-avatar"
              src={loginState.avatarUrl}
              alt=""
            />
          ) : (
            <UserRound size={17} />
          )}
          <span className="account-label">
            {loginState.loggedIn
              ? loginState.userName ||
                (language === "zh" ? "已登录" : "Account")
              : translate(language, "login")}
          </span>
        </button>
      </div>

      <div className="window-controls drag-disabled">
        <button
          className="window-control"
          type="button"
          onClick={() => window.studyflow?.minimizeWindow()}
          aria-label="Minimize"
        >
          <Minus size={15} />
        </button>
        <button
          className="window-control"
          type="button"
          onClick={() => window.studyflow?.toggleMaximizeWindow()}
          aria-label="Maximize"
        >
          <Maximize2 size={13} />
        </button>
        <button
          className="window-control close"
          type="button"
          onClick={() => window.studyflow?.closeWindow()}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  );
}
