import {
  Camera,
  Download,
  Eye,
  FolderOpen,
  Languages,
  ListFilter,
  PenLine,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type {
  AppPreferences,
  Language,
  LearningMode,
  UpdateState,
} from "../types";
import { modeLabel, subjectLabel, translate } from "../i18n";
import {
  enabledLearningSubjects,
  learningSubjects,
} from "../lib/subjects";

interface SettingsPageProps {
  language: Language;
  preferences: AppPreferences;
  updateState: UpdateState | null;
  updateBusy: boolean;
  onChange: (preferences: AppPreferences) => void;
  onReset: () => void;
  onCheckForUpdates: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
}

export function SettingsPage({
  language,
  preferences,
  updateState,
  updateBusy,
  onChange,
  onReset,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
}: SettingsPageProps) {
  const activeSubjects = enabledLearningSubjects(preferences.enabledSubjects);

  function update<K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K],
  ) {
    onChange({ ...preferences, [key]: value });
  }

  function toggleSubject(subject: AppPreferences["enabledSubjects"][number]) {
    const selected = activeSubjects.includes(subject);
    if (selected && activeSubjects.length === 1) return;
    update(
      "enabledSubjects",
      selected
        ? activeSubjects.filter((item) => item !== subject)
        : [...activeSubjects, subject],
    );
  }

  async function chooseScreenshotDirectory() {
    if (!window.studyflow) return;
    const directory = await window.studyflow.chooseScreenshotDirectory(
      preferences.screenshotDirectory,
    );
    if (directory) update("screenshotDirectory", directory);
  }

  function updateStatusLabel(state: UpdateState | null) {
    if (!state) return language === "zh" ? "正在读取版本信息" : "Loading version";
    if (state.status === "not-configured") {
      return language === "zh"
        ? "发布构建尚未配置 GitHub 仓库"
        : "This build has no GitHub release repository configured";
    }
    if (state.status === "disabled") {
      return language === "zh"
        ? "自动更新仅在已安装版本中启用"
        : "Automatic updates are enabled in installed builds";
    }
    if (state.status === "checking") {
      return language === "zh" ? "正在检查更新" : "Checking for updates";
    }
    if (state.status === "available") {
      return language === "zh"
        ? `发现新版本 ${state.latestVersion}`
        : `Version ${state.latestVersion} is available`;
    }
    if (state.status === "downloading") {
      return language === "zh"
        ? `正在下载 ${Math.round(state.percent)}%`
        : `Downloading ${Math.round(state.percent)}%`;
    }
    if (state.status === "downloaded") {
      return language === "zh"
        ? `版本 ${state.latestVersion} 已下载`
        : `Version ${state.latestVersion} is ready`;
    }
    if (state.status === "not-available") {
      return language === "zh" ? "当前已经是最新版本" : "You are up to date";
    }
    if (state.status === "error") {
      return state.message || (language === "zh" ? "更新失败" : "Update failed");
    }
    return language === "zh" ? "等待检查" : "Ready to check";
  }

  return (
    <section className="page settings-page">
      <div className="page-heading">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          PREFERENCES / 05
        </div>
        <h1>{translate(language, "settings")}</h1>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-heading">
            <Languages size={20} />
            <div>
              <h2>{translate(language, "settingsGeneral")}</h2>
              <p>{translate(language, "language")}</p>
            </div>
          </div>
          <div className="segmented-control wide">
            <button
              type="button"
              className={preferences.language === "zh" ? "active" : ""}
              onClick={() => update("language", "zh")}
            >
              {translate(language, "chinese")}
            </button>
            <button
              type="button"
              className={preferences.language === "en" ? "active" : ""}
              onClick={() => update("language", "en")}
            >
              {translate(language, "english")}
            </button>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-heading">
            <ShieldCheck size={20} />
            <div>
              <h2>{translate(language, "recommendation")}</h2>
              <p>{translate(language, "learningMode")}</p>
            </div>
          </div>
          <div className="segmented-control wide">
            {(["focus", "balanced", "explore"] as LearningMode[]).map((mode) => (
              <button
                type="button"
                key={mode}
                className={preferences.mode === mode ? "active" : ""}
                onClick={() => update("mode", mode)}
              >
                {modeLabel(language, mode)}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-card wide-card">
          <div className="settings-card-heading">
            <Eye size={20} />
            <div>
              <h2>{translate(language, "recommendation")}</h2>
              <p>{translate(language, "hideAdsHelp")}</p>
            </div>
          </div>

          <label className="toggle-row">
            <span>
              <strong>{translate(language, "hideAds")}</strong>
              <small>{translate(language, "hideAdsHelp")}</small>
            </span>
            <input
              type="checkbox"
              checked={preferences.hideAds}
              onChange={(event) => update("hideAds", event.target.checked)}
            />
            <span className="toggle-ui">
              <span />
            </span>
          </label>

          <label className="toggle-row">
            <span>
              <strong>{translate(language, "showScores")}</strong>
              <small>{translate(language, "showScoresHelp")}</small>
            </span>
            <input
              type="checkbox"
              checked={preferences.showScores}
              onChange={(event) => update("showScores", event.target.checked)}
            />
            <span className="toggle-ui">
              <span />
            </span>
          </label>

          <label className="toggle-row">
            <span>
              <strong>
                {language === "zh" ? "播放器弹幕" : "Player danmaku"}
              </strong>
              <small>
                {language === "zh"
                  ? "在应用内播放器中显示当前视频的弹幕。"
                  : "Show timed comments in the in-app player."}
              </small>
            </span>
            <input
              type="checkbox"
              checked={preferences.danmakuEnabled}
              onChange={(event) =>
                update("danmakuEnabled", event.target.checked)
              }
            />
            <span className="toggle-ui">
              <span />
            </span>
          </label>
        </div>

        <div className="settings-card wide-card">
          <div className="settings-card-heading">
            <ListFilter size={20} />
            <div>
              <h2>
                {language === "zh" ? "学习领域" : "Learning subjects"}
              </h2>
              <p>
                {language === "zh"
                  ? `只接收需要的分类，当前启用 ${activeSubjects.length}/${learningSubjects.length} 个领域。`
                  : `Choose the subjects you want. ${activeSubjects.length} of ${learningSubjects.length} enabled.`}
              </p>
            </div>
          </div>

          <div className="subject-preference-grid">
            {learningSubjects.map((subject) => {
              const selected = activeSubjects.includes(subject);
              const disabled = selected && activeSubjects.length === 1;
              return (
                <label
                  className={
                    selected
                      ? "subject-preference selected"
                      : "subject-preference"
                  }
                  key={subject}
                  title={
                    disabled
                      ? language === "zh"
                        ? "至少保留一个学习领域"
                        : "Keep at least one learning subject"
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => toggleSubject(subject)}
                  />
                  <span>{subjectLabel(language, subject)}</span>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            className="enable-all-subjects"
            disabled={activeSubjects.length === learningSubjects.length}
            onClick={() => update("enabledSubjects", [...learningSubjects])}
          >
            {language === "zh" ? "启用全部领域" : "Enable all subjects"}
          </button>
        </div>

        <div className="settings-card">
          <div className="settings-card-heading">
            <PenLine size={20} />
            <div>
              <h2>
                {language === "zh" ? "侧栏文字" : "Sidebar text"}
              </h2>
              <p>
                {language === "zh"
                  ? `在左侧导航的空白区域竖排显示。使用 ${"\\".repeat(2)} 强制另起一列，也可以直接换行。`
                  : `Show vertical text in the empty left navigation area. Use ${"\\".repeat(2)} or a new line to start another column.`}
              </p>
            </div>
          </div>
          <label className="sidebar-text-setting">
            <textarea
              value={preferences.sidebarCustomText}
              maxLength={80}
              rows={3}
              placeholder={
                language === "zh"
                  ? `例如：保持专注${"\\".repeat(2)}每天学习一点`
                  : `For example: Stay focused${"\\".repeat(2)}Learn every day`
              }
              onChange={(event) =>
                update("sidebarCustomText", event.target.value)
              }
            />
            <span>{preferences.sidebarCustomText.length}/80</span>
          </label>
        </div>

        <div className="settings-card wide-card">
          <div className="settings-card-heading">
            <Camera size={20} />
            <div>
              <h2>{language === "zh" ? "截图保存" : "Screenshot storage"}</h2>
              <p>
                {language === "zh"
                  ? "播放器截图会按视频或合集名称自动建立文件夹。"
                  : "Player screenshots are grouped into video or series folders."}
              </p>
            </div>
          </div>
          <div className="screenshot-directory-row">
            <div className="screenshot-directory-copy">
              <span>{language === "zh" ? "默认保存位置" : "Default location"}</span>
              <code title={preferences.screenshotDirectory || undefined}>
                {preferences.screenshotDirectory ||
                  (language === "zh"
                    ? "图片 / BiliBili Learning Version"
                    : "Pictures / BiliBili Learning Version")}
              </code>
            </div>
            <button type="button" onClick={chooseScreenshotDirectory}>
              <FolderOpen size={16} />
              {language === "zh" ? "选择文件夹" : "Choose folder"}
            </button>
          </div>
        </div>

        <div className="settings-card wide-card update-settings-card">
          <div className="settings-card-heading">
            <RefreshCw size={20} />
            <div>
              <h2>{language === "zh" ? "软件更新" : "Software updates"}</h2>
              <p>
                {language === "zh"
                  ? `当前版本 ${updateState?.currentVersion || "-"}。更新通过 GitHub Releases 发布。`
                  : `Current version ${updateState?.currentVersion || "-"}. Updates are delivered through GitHub Releases.`}
              </p>
            </div>
          </div>

          <div className="update-status-row">
            <span
              className={
                updateState?.status === "error"
                  ? "update-status error"
                  : "update-status"
              }
            >
              {updateStatusLabel(updateState)}
            </span>
            {updateState?.releasesUrl && (
              <button
                type="button"
                onClick={() => window.studyflow?.openExternal(updateState.releasesUrl)}
              >
                {language === "zh" ? "查看发布页" : "View releases"}
              </button>
            )}
          </div>

          {updateState?.status === "downloading" && (
            <div className="update-progress" aria-label={updateStatusLabel(updateState)}>
              <span style={{ width: `${Math.max(0, Math.min(100, updateState.percent))}%` }} />
            </div>
          )}

          <div className="update-actions">
            <button
              type="button"
              onClick={onCheckForUpdates}
              disabled={updateBusy || updateState?.status === "checking"}
            >
              <RefreshCw
                size={15}
                className={updateState?.status === "checking" ? "spin" : ""}
              />
              {language === "zh" ? "检查更新" : "Check for updates"}
            </button>
            {updateState?.status === "available" && (
              <button type="button" onClick={onDownloadUpdate} disabled={updateBusy}>
                <Download size={15} />
                {language === "zh" ? "下载更新" : "Download update"}
              </button>
            )}
            {updateState?.status === "downloaded" && (
              <button type="button" onClick={onInstallUpdate} disabled={updateBusy}>
                <Download size={15} />
                {language === "zh" ? "重启并安装" : "Restart and install"}
              </button>
            )}
          </div>
        </div>

        <div className="settings-card wide-card">
          <div className="settings-card-heading">
            <ShieldCheck size={20} />
            <div>
              <h2>{translate(language, "blockedAuthors")}</h2>
              <p>
                {preferences.blockedAuthors.length === 0
                  ? translate(language, "noBlockedAuthors")
                  : preferences.blockedAuthors.join(" · ")}
              </p>
            </div>
          </div>
          {preferences.blockedAuthors.length > 0 && (
            <div className="blocked-list">
              {preferences.blockedAuthors.map((author) => (
                <button
                  type="button"
                  key={author}
                  onClick={() =>
                    update(
                      "blockedAuthors",
                      preferences.blockedAuthors.filter((item) => item !== author),
                    )
                  }
                >
                  <span>{author}</span>
                  {translate(language, "unblock")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button type="button" className="reset-button" onClick={onReset}>
        <RotateCcw size={15} />
        {translate(language, "resetPreferences")}
      </button>
    </section>
  );
}
