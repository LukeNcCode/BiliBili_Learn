import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Droplets, X } from "lucide-react";
import type {
  AppPreferences,
  ClassifiedVideo,
  CreatorProject,
  ImportedLearningList,
  LearningPlaybackSession,
  LearningCourse,
  LearningLesson,
  LearningSection,
  Language,
  LoginState,
  PlaybackProgress,
  Screen,
  StudyHistory,
  SubtitleResult,
  UpdateState,
  VideoCandidate,
} from "./types";
import { demoFeed } from "./data/demoFeed";
import { learningSeeds } from "./data/learningSeeds";
import {
  applySemanticSubject,
  classifyFeed,
  classifyVideo,
} from "./lib/classifier";
import { SubjectKey } from "./types";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { FeedPage } from "./components/FeedPage";
import { SearchPage } from "./components/SearchPage";
import { SettingsPage } from "./components/SettingsPage";
import { CollectionPage } from "./components/CollectionPage";
import { AuthModal } from "./components/AuthModal";
import { VideoPage } from "./components/VideoPage";
import { LearningListsPage } from "./components/LearningListsPage";
import { CreatorModePage } from "./components/CreatorModePage";
import { normalizeCreatorProject } from "./lib/creator";
import { createLearningAffinityIndex } from "./lib/learningAffinity";
import {
  classifyVideosLocally,
  warmupLocalSemanticModel,
  type SemanticClassification,
  type SemanticStatus,
} from "./lib/localSemantic";
import { normalizeOfflineLearningList } from "./lib/offlineList";
import {
  normalizeFeedbackMap,
  normalizeHistory,
  normalizeLearningLists,
  normalizeNumberMap,
  normalizeProgressMap,
  normalizeSavedSnapshots,
  normalizeStringList,
} from "./lib/persistentData";
import { collectSavedVideos } from "./lib/savedVideos";
import {
  enabledLearningSubjects,
  isSubjectScopeEnabled,
  learningSubjects,
} from "./lib/subjects";
import { videoKey } from "./lib/videoKey";

const STORAGE_KEYS = {
  preferences: "studyflow.preferences.v2",
  feedback: "studyflow.feedback.v1",
  saved: "studyflow.saved.v1",
  savedSnapshots: "studyflow.saved-snapshots.v1",
  history: "studyflow.history.v1",
  progress: "studyflow.playback-progress.v1",
  learningLists: "studyflow.learning-lists.v1",
  watchTime: "studyflow.watch-time.v1",
};

const PERSISTENT_KEYS = {
  feedback: "feedback",
  saved: "saved",
  savedSnapshots: "saved-snapshots",
  history: "history",
  progress: "progress",
  learningLists: "learning-lists",
  watchTime: "watch-time",
};

const MAX_LOCAL_IMPORT_BYTES = 5 * 1024 * 1024;

const defaultPreferences: AppPreferences = {
  language: "zh",
  theme: "dark",
  mode: "balanced",
  hideAds: true,
  showScores: false,
  danmakuEnabled: true,
  playerVolume: 0.85,
  playbackRate: 1,
  preferredQuality: null,
  blockedAuthors: [],
  enabledSubjects: [...learningSubjects],
  sidebarCustomText: "",
  screenshotDirectory: "",
};

function readPreferences(): AppPreferences {
  const stored = readStorage<Record<string, unknown>>(
    STORAGE_KEYS.preferences,
    {},
  );
  const enabledSubjects = Array.isArray(stored.enabledSubjects)
    ? stored.enabledSubjects.filter((subject) =>
        learningSubjects.includes(subject as (typeof learningSubjects)[number]),
      )
    : defaultPreferences.enabledSubjects;
  return {
    ...defaultPreferences,
    language: stored.language === "en" ? "en" : "zh",
    theme: stored.theme === "light" ? "light" : "dark",
    mode:
      stored.mode === "focus" ||
      stored.mode === "balanced" ||
      stored.mode === "explore"
        ? stored.mode
        : defaultPreferences.mode,
    hideAds:
      typeof stored.hideAds === "boolean"
        ? stored.hideAds
        : defaultPreferences.hideAds,
    showScores:
      typeof stored.showScores === "boolean"
        ? stored.showScores
        : defaultPreferences.showScores,
    danmakuEnabled:
      typeof stored.danmakuEnabled === "boolean"
        ? stored.danmakuEnabled
        : defaultPreferences.danmakuEnabled,
    playerVolume: Math.min(
      1,
      Math.max(0, Number.isFinite(Number(stored.playerVolume))
        ? Number(stored.playerVolume)
        : defaultPreferences.playerVolume),
    ),
    playbackRate: Math.min(
      3,
      Math.max(0.5, Number.isFinite(Number(stored.playbackRate))
        ? Number(stored.playbackRate)
        : defaultPreferences.playbackRate),
    ),
    preferredQuality:
      stored.preferredQuality === null ||
      Number.isFinite(Number(stored.preferredQuality))
        ? (stored.preferredQuality === null
            ? null
            : Number(stored.preferredQuality))
        : null,
    blockedAuthors: normalizeStringList(stored.blockedAuthors).slice(0, 500),
    enabledSubjects:
      enabledSubjects.length > 0
        ? (enabledSubjects as AppPreferences["enabledSubjects"])
        : defaultPreferences.enabledSubjects,
    sidebarCustomText:
      typeof stored.sidebarCustomText === "string"
        ? stored.sidebarCustomText.slice(0, 80)
        : "",
    screenshotDirectory:
      typeof stored.screenshotDirectory === "string"
        ? stored.screenshotDirectory.slice(0, 1000)
        : "",
  };
}

const HYDRATION_REMINDER_INTERVAL_MS = 45 * 60 * 1000;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browser-preview preferences remain session-local if storage is unavailable.
  }
}

function mergeCandidates(
  current: VideoCandidate[],
  incoming: VideoCandidate[],
) {
  const map = new Map(current.map((item) => [videoKey(item), item]));
  incoming.forEach((item) => map.set(videoKey(item), item));
  return [...map.values()];
}

export default function App() {
  const [preferences, setPreferences] = useState<AppPreferences>(readPreferences);
  const [screen, setScreen] = useState<Screen>("home");
  const [feed, setFeed] = useState<VideoCandidate[]>(demoFeed);
  const [catalog, setCatalog] = useState<VideoCandidate[]>(demoFeed);
  const [searchResults, setSearchResults] = useState<VideoCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ClassifiedVideo | null>(
    null,
  );
  const [learningPlaybackSession, setLearningPlaybackSession] =
    useState<LearningPlaybackSession | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey | "all">(
    "all",
  );
  const [feedbackMap, setFeedbackMap] = useState<Record<string, number>>(() =>
    readStorage(STORAGE_KEYS.feedback, {}),
  );
  const [savedKeys, setSavedKeys] = useState<string[]>(() =>
    readStorage(STORAGE_KEYS.saved, []),
  );
  const [savedSnapshots, setSavedSnapshots] = useState<
    Record<string, ClassifiedVideo>
  >(() => readStorage(STORAGE_KEYS.savedSnapshots, {}));
  const [history, setHistory] = useState<StudyHistory[]>(() =>
    readStorage(STORAGE_KEYS.history, []),
  );
  const [playbackProgress, setPlaybackProgress] = useState<
    Record<string, PlaybackProgress>
  >(() => readStorage(STORAGE_KEYS.progress, {}));
  const [watchTimeByUser, setWatchTimeByUser] = useState<
    Record<string, number>
  >(() => readStorage(STORAGE_KEYS.watchTime, {}));
  const [learningLists, setLearningLists] = useState<ImportedLearningList[]>(
    () => readStorage(STORAGE_KEYS.learningLists, []),
  );
  const [loginState, setLoginState] = useState<LoginState>({
    loggedIn: false,
    userId: null,
    userName: null,
    avatarUrl: null,
    followers: null,
    following: null,
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [liveSource, setLiveSource] = useState(false);
  const [warning, setWarning] = useState("");
  const [toast, setToast] = useState("");
  const [hydrationReminderOpen, setHydrationReminderOpen] = useState(false);
  const [miniPlayerActive, setMiniPlayerActive] = useState(false);
  const [learningListImporting, setLearningListImporting] = useState(false);
  const [learningListError, setLearningListError] = useState("");
  const [persistentDataReady, setPersistentDataReady] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [semanticClassifications, setSemanticClassifications] = useState<
    Record<string, SemanticClassification>
  >({});
  const [semanticStatus, setSemanticStatus] =
    useState<SemanticStatus>("idle");
  const initialThemeEffect = useRef(true);
  const persistenceErrorShown = useRef(false);
  const feedRequestId = useRef(0);
  const searchRequestId = useRef(0);
  const lastUpdateNotice = useRef("");
  const [creatorProject, setCreatorProject] = useState<CreatorProject>(() =>
    normalizeCreatorProject({}),
  );
  const [creatorSearchRequest, setCreatorSearchRequest] = useState<{
    id: number;
    query: string;
  } | null>(null);
  const learningAffinityIndex = useMemo(
    () => createLearningAffinityIndex(learningLists),
    [learningLists],
  );
  const enabledSubjects = useMemo(
    () => enabledLearningSubjects(preferences.enabledSubjects),
    [preferences.enabledSubjects],
  );

  const language = preferences.language;
  const watchTimeOwner = loginState.userId
    ? `user:${loginState.userId}`
    : "local";
  const watchTimeSeconds = watchTimeByUser[watchTimeOwner] || 0;

  function addWatchTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    setWatchTimeByUser((current) => ({
      ...current,
      [watchTimeOwner]: (current[watchTimeOwner] || 0) + seconds,
    }));
  }

  function persistCore(key: string, value: unknown) {
    if (!persistentDataReady) return;
    if (!window.studyflow) {
      writeStorage(`studyflow.${key}.v1`, value);
      return;
    }
    void window.studyflow.savePersistentItem(key, value).catch(() => {
      if (persistenceErrorShown.current) return;
      persistenceErrorShown.current = true;
      setToast(
        language === "zh"
          ? "学习数据保存失败，请检查磁盘空间"
          : "Unable to save learning data. Check available disk space.",
      );
    });
  }

  useEffect(() => {
    let active = true;
    async function hydratePersistentData() {
      if (!window.studyflow) {
        if (active) setPersistentDataReady(true);
        return;
      }
      try {
        const [
          feedback,
          saved,
          savedSnapshots,
          history,
          progress,
          learningLists,
          watchTime,
          screenshotDirectory,
        ] = await Promise.all([
          window.studyflow.loadPersistentItem(PERSISTENT_KEYS.feedback),
          window.studyflow.loadPersistentItem(PERSISTENT_KEYS.saved),
          window.studyflow.loadPersistentItem(PERSISTENT_KEYS.savedSnapshots),
          window.studyflow.loadPersistentItem(PERSISTENT_KEYS.history),
          window.studyflow.loadPersistentItem(PERSISTENT_KEYS.progress),
          window.studyflow.loadPersistentItem(PERSISTENT_KEYS.learningLists),
          window.studyflow.loadPersistentItem(PERSISTENT_KEYS.watchTime),
          window.studyflow.getScreenshotDirectory(),
        ]);
        if (!active) return;
        if (feedback !== null) setFeedbackMap(normalizeFeedbackMap(feedback));
        if (saved !== null) setSavedKeys(normalizeStringList(saved));
        if (savedSnapshots !== null) {
          setSavedSnapshots(normalizeSavedSnapshots(savedSnapshots));
        }
        if (history !== null) setHistory(normalizeHistory(history));
        if (progress !== null) {
          setPlaybackProgress(normalizeProgressMap(progress));
        }
        if (learningLists !== null) {
          setLearningLists(normalizeLearningLists(learningLists));
        }
        if (watchTime !== null) {
          setWatchTimeByUser(normalizeNumberMap(watchTime));
        }
        if (screenshotDirectory) {
          setPreferences((current) => ({
            ...current,
            screenshotDirectory,
          }));
        }
      } catch {
        if (active && !persistenceErrorShown.current) {
          persistenceErrorShown.current = true;
          setToast(
            language === "zh"
              ? "部分学习数据无法读取，已使用本地缓存"
              : "Some learning data could not be read; using local cache.",
          );
        }
      } finally {
        if (active) setPersistentDataReady(true);
      }
    }
    void hydratePersistentData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.preferences, preferences);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [preferences, language]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    if (initialThemeEffect.current) {
      initialThemeEffect.current = false;
      return;
    }
    root.classList.add("theme-transitioning");
    const timeout = window.setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 420);
    return () => window.clearTimeout(timeout);
  }, [preferences.theme]);

  useEffect(() => {
    persistCore(PERSISTENT_KEYS.feedback, feedbackMap);
  }, [feedbackMap, persistentDataReady]);
  useEffect(() => {
    persistCore(PERSISTENT_KEYS.saved, savedKeys);
  }, [savedKeys, persistentDataReady]);
  useEffect(
    () => persistCore(PERSISTENT_KEYS.savedSnapshots, savedSnapshots),
    [savedSnapshots, persistentDataReady],
  );
  useEffect(
    () => persistCore(PERSISTENT_KEYS.history, history),
    [history, persistentDataReady],
  );
  useEffect(
    () => persistCore(PERSISTENT_KEYS.progress, playbackProgress),
    [playbackProgress, persistentDataReady],
  );
  useEffect(
    () => persistCore(PERSISTENT_KEYS.watchTime, watchTimeByUser),
    [watchTimeByUser, persistentDataReady],
  );
  useEffect(
    () => persistCore(PERSISTENT_KEYS.learningLists, learningLists),
    [learningLists, persistentDataReady],
  );
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setHydrationReminderOpen(true),
      HYDRATION_REMINDER_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (!window.studyflow) {
        setFeedLoading(false);
        setWarning("browser-preview");
        return;
      }
      try {
        const [stateResult, recommendationResult] = await Promise.allSettled([
          window.studyflow.getLoginState(),
          window.studyflow.getRecommendations(),
        ]);
        if (!active) return;
        if (stateResult.status === "fulfilled") setLoginState(stateResult.value);
        const recommendations =
          recommendationResult.status === "fulfilled"
            ? recommendationResult.value
            : null;
        if (!recommendations) throw new Error("Recommendations unavailable");
        if (recommendations.items.length > 0) {
          setFeed((current) =>
            mergeCandidates(
              recommendations.items,
              current.filter((item) => item.source === "bilibili"),
            ).slice(0, 240),
          );
          setCatalog((current) => mergeCandidates(current, recommendations.items));
          setLiveSource(true);
          setWarning(recommendations.warning || "");
        }
      } catch {
        if (active) {
          setFeed(demoFeed);
          setLiveSource(false);
          setWarning("fallback");
        }
      } finally {
        if (active) setFeedLoading(false);
      }
    }
    initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!window.studyflow) return;
    return window.studyflow.onLoginChanged((state) => {
      setLoginState(state);
      setToast(language === "zh" ? "B站账号已连接" : "Bilibili account connected");
    });
  }, [language]);

  useEffect(() => {
    if (!window.studyflow) return;
    return window.studyflow.onMiniPlayerChanged(setMiniPlayerActive);
  }, []);

  useEffect(() => {
    if (!window.studyflow) return;
    return window.studyflow.onOpenCreatorMode(() => {
      setSelectedVideo(null);
      setLearningPlaybackSession(null);
      setScreen("creator");
    });
  }, []);

  useEffect(() => {
    if (!window.studyflow) return;
    let active = true;
    void window.studyflow
      .getUpdateState()
      .then((state) => {
        if (active) setUpdateState(state);
      })
      .catch(() => undefined);
    const unsubscribe = window.studyflow.onUpdateChanged((state) => {
      if (!active) return;
      setUpdateState(state);
      const noticeKey =
        state.status === "available" || state.status === "downloaded"
          ? `${state.status}:${state.latestVersion}`
          : "";
      if (!noticeKey || noticeKey === lastUpdateNotice.current) return;
      lastUpdateNotice.current = noticeKey;
      setToast(
        state.status === "downloaded"
          ? language === "zh"
            ? `版本 ${state.latestVersion} 已下载，可在设置中重启安装`
            : `Version ${state.latestVersion} is ready in Settings`
          : language === "zh"
            ? `发现新版本 ${state.latestVersion}`
            : `Version ${state.latestVersion} is available`,
      );
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [language]);

  useEffect(() => {
    document.body.classList.toggle("mini-player-active", miniPlayerActive);
    return () => document.body.classList.remove("mini-player-active");
  }, [miniPlayerActive]);

  useEffect(() => {
    if (
      selectedSubject !== "all" &&
      !enabledSubjects.includes(selectedSubject)
    ) {
      setSelectedSubject("all");
    }
  }, [enabledSubjects, selectedSubject]);

  const baseClassifiedFeed = useMemo(() => {
    return classifyFeed(
      feed,
      preferences.mode,
      feedbackMap,
      preferences.blockedAuthors,
      learningAffinityIndex,
    ).map((video) =>
      !preferences.hideAds && video.route === "ad"
        ? { ...video, hidden: false }
        : video,
    );
  }, [
    feed,
    preferences.mode,
    preferences.hideAds,
    preferences.blockedAuthors,
    feedbackMap,
    learningAffinityIndex,
  ]);

  const needsLearningSupplement =
    liveSource &&
    baseClassifiedFeed.filter((video) => !video.hidden).length < 6;
  const displayFeed = useMemo(
    () =>
      needsLearningSupplement
        ? mergeCandidates(feed, learningSeeds)
        : feed,
    [feed, needsLearningSupplement],
  );
  const semanticCandidates = useMemo(() => {
    const candidates = new Map<
      string,
      { bvid: string; text: string }
    >();
    [...displayFeed, ...searchResults].forEach((video) => {
      if (!video.bvid || candidates.has(video.bvid)) return;
      candidates.set(video.bvid, {
        bvid: video.bvid,
        text: [
          video.title,
          video.title,
          video.title,
          ...video.tags,
          video.description.slice(0, 180),
        ].join(" "),
      });
    });
    return [...candidates.values()].slice(0, 64);
  }, [displayFeed, searchResults]);

  useEffect(() => {
    void warmupLocalSemanticModel().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (feedLoading || semanticCandidates.length === 0) {
      setSemanticStatus("idle");
      return;
    }
    let active = true;
    setSemanticStatus("loading");
    const timer = window.setTimeout(() => {
      void classifyVideosLocally(semanticCandidates)
        .then((results) => {
          if (!active) return;
          setSemanticClassifications((current) => {
            const next = { ...current };
            results.forEach((result) => {
              next[result.bvid] = result;
            });
            return next;
          });
          setSemanticStatus("ready");
        })
        .catch(() => {
          if (active) setSemanticStatus("error");
        });
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [feedLoading, semanticCandidates]);

  const classifiedFeed = useMemo(() => {
    return classifyFeed(
      displayFeed,
      preferences.mode,
      feedbackMap,
      preferences.blockedAuthors,
      learningAffinityIndex,
    )
      .map((video) =>
        !preferences.hideAds && video.route === "ad"
          ? { ...video, hidden: false }
          : video,
      )
      .map((video) =>
        applySemanticSubject(video, semanticClassifications[video.bvid]),
      );
  }, [
    displayFeed,
    preferences.mode,
    preferences.hideAds,
    preferences.blockedAuthors,
    feedbackMap,
    learningAffinityIndex,
    semanticClassifications,
  ]);

  const visibleFeed = useMemo(
    () =>
      classifiedFeed.filter(
        (video) => {
          if (
            video.hidden ||
            !isSubjectScopeEnabled(
              video.subject,
              video.topics,
              enabledSubjects,
            )
          ) {
            return false;
          }
          return (
            (selectedSubject === "all" || video.subject === selectedSubject)
          );
        },
      ),
    [classifiedFeed, enabledSubjects, selectedSubject],
  );

  const classifiedSearch = useMemo(
    () =>
      searchResults
        .map((video) =>
          applySemanticSubject(
            classifyVideo(
              video,
              "explore",
              feedbackMap[videoKey(video)] || 0,
              preferences.blockedAuthors,
              learningAffinityIndex,
            ),
            semanticClassifications[video.bvid],
          ),
        )
        .filter(
          (video) =>
            video.route !== "ad" &&
            !preferences.blockedAuthors.includes(video.author),
        )
        .sort((left, right) => right.learningScore - left.learningScore),
    [
      searchResults,
      preferences.blockedAuthors,
      feedbackMap,
      learningAffinityIndex,
      semanticClassifications,
    ],
  );

  const classifiedCatalog = useMemo(
    () =>
      classifyFeed(
        catalog,
        preferences.mode,
        feedbackMap,
        preferences.blockedAuthors,
        learningAffinityIndex,
      ).map((video) =>
        applySemanticSubject(video, semanticClassifications[video.bvid]),
      ),
    [
      catalog,
      preferences.mode,
      preferences.blockedAuthors,
      feedbackMap,
      learningAffinityIndex,
      semanticClassifications,
    ],
  );

  const savedSet = useMemo(() => new Set(savedKeys), [savedKeys]);
  const savedVideos = useMemo(
    () =>
      collectSavedVideos(savedKeys, [
        ...classifiedCatalog,
        ...classifiedFeed,
        ...classifiedSearch,
        ...Object.values(savedSnapshots),
        ...(selectedVideo ? [selectedVideo] : []),
      ]),
    [
      classifiedCatalog,
      classifiedFeed,
      classifiedSearch,
      savedKeys,
      savedSnapshots,
      selectedVideo,
    ],
  );
  useEffect(() => {
    if (savedKeys.length === 0) return;
    setSavedSnapshots((current) => {
      const known = new Map<string, ClassifiedVideo>();
      [...classifiedCatalog, ...classifiedFeed, ...classifiedSearch].forEach(
        (video) => known.set(videoKey(video), video),
      );
      let changed = false;
      const next = { ...current };
      savedKeys.forEach((key) => {
        const video = known.get(key);
        if (!next[key] && video) {
          next[key] = video;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [savedKeys, classifiedCatalog, classifiedFeed, classifiedSearch]);
  const related = useMemo(() => {
    if (!selectedVideo) return [];
    return classifiedFeed
      .filter(
        (video) =>
          !video.hidden &&
          videoKey(video) !== videoKey(selectedVideo) &&
          video.subject === selectedVideo.subject,
      )
      .slice(0, 3);
  }, [classifiedFeed, selectedVideo]);

  async function loadFeed(force = false) {
    const requestId = ++feedRequestId.current;
    setFeedLoading(true);
    setWarning("");
    try {
      if (!window.studyflow) throw new Error("Desktop API unavailable");
      const result = await window.studyflow.getRecommendations(force);
      if (requestId !== feedRequestId.current) return;
      const items = result.items.length > 0 ? result.items : demoFeed;
      setFeed((current) =>
        force
          ? items
          : mergeCandidates(
              items,
              current.filter((item) => item.source === "bilibili"),
            ).slice(0, 240),
      );
      setCatalog((current) => mergeCandidates(current, items));
      setLiveSource(result.items.length > 0);
      setWarning(result.warning || "");
    } catch {
      if (requestId !== feedRequestId.current) return;
      setFeed(demoFeed);
      setLiveSource(false);
      setWarning("fallback");
    } finally {
      if (requestId === feedRequestId.current) setFeedLoading(false);
    }
  }

  async function search(query: string) {
    const requestId = ++searchRequestId.current;
    setScreen("search");
    setSelectedVideo(null);
    setSearchQuery(query);
    setSearched(true);
    setSearchLoading(true);
    try {
      if (!window.studyflow) throw new Error("Desktop API unavailable");
      const result = await window.studyflow.searchVideos(query);
      if (requestId !== searchRequestId.current) return;
      if (result.items.length === 0) {
        throw new Error("No remote results");
      }
      setSearchResults(result.items);
      setCatalog((current) => mergeCandidates(current, result.items));
    } catch {
      if (requestId !== searchRequestId.current) return;
      const queryLower = query.toLocaleLowerCase();
      const tokens = queryLower.split(/\s+/).filter(Boolean);
      const localResults = [...demoFeed, ...learningSeeds]
        .map((video) => {
          const searchText =
            `${video.title} ${video.author} ${video.tags.join(" ")}`.toLocaleLowerCase();
          const hits = tokens.filter((token) => searchText.includes(token)).length;
          return { video, hits };
        })
        .filter((item) => item.hits > 0)
        .sort((left, right) => right.hits - left.hits)
        .map((item) => item.video);
      setSearchResults(localResults);
      setToast(
        language === "zh"
          ? "搜索接口暂时受限，已使用本地结果"
          : "Search is temporarily limited; using local results",
      );
    } finally {
      if (requestId === searchRequestId.current) setSearchLoading(false);
    }
  }

  function navigate(nextScreen: Screen) {
    setSelectedVideo(null);
    setLearningPlaybackSession(null);
    setScreen(nextScreen);
  }

  function searchFromHeader(query: string) {
    if (screen === "creator") {
      setCreatorSearchRequest({ id: Date.now(), query });
      return;
    }
    void search(query);
  }

  function openVideo(
    video: ClassifiedVideo,
    learningSession: LearningPlaybackSession | null = null,
  ) {
    setLearningPlaybackSession(learningSession);
    setSelectedVideo(video);
    setCatalog((current) => mergeCandidates(current, [video]));
    const historyEntry: StudyHistory = {
      bvid: videoKey(video),
      title: video.title,
      cover: video.cover,
      author: video.author,
      subject: video.subject,
      watchedAt: Date.now(),
    };
    setHistory((current) => [
      historyEntry,
      ...current.filter((item) => item.bvid !== historyEntry.bvid),
    ].slice(0, 30));
  }

  function openHistoryEntry(entry: StudyHistory) {
    setLearningPlaybackSession(null);
    const candidate =
      catalog.find((video) => videoKey(video) === entry.bvid) ||
      ({
        id: entry.bvid,
        bvid: entry.bvid,
        title: entry.title,
        description: "",
        cover: entry.cover,
        author: entry.author,
        authorId: "",
        duration: 0,
        publishedAt: 0,
        views: 0,
        likes: 0,
        category: "",
        tags: [],
        position: 0,
        recommendReason: "",
        source: "demo",
      } satisfies VideoCandidate);
    const classified =
      classifiedCatalog.find((video) => videoKey(video) === entry.bvid) ||
      classifyVideo(
        candidate,
        preferences.mode,
        feedbackMap[entry.bvid] || 0,
        preferences.blockedAuthors,
        learningAffinityIndex,
      );
    setSelectedVideo(classified);
  }

  function saveVideo(video: ClassifiedVideo) {
    const key = videoKey(video);
    const isSaved = savedSet.has(key);
    setSavedKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [key, ...current],
    );
    setSavedSnapshots((current) => {
      const next = { ...current };
      if (isSaved) delete next[key];
      else next[key] = video;
      return next;
    });
    setToast(
      isSaved
        ? language === "zh"
          ? "已取消收藏"
          : "Removed from library"
        : language === "zh"
          ? "已收藏"
          : "Saved to library",
    );
  }

  function feedback(video: ClassifiedVideo, value: number) {
    const key = videoKey(video);
    setFeedbackMap((current) => {
      const next = current[key] === value ? 0 : value;
      return { ...current, [key]: next };
    });
    setToast(
      value > 0
        ? language === "zh"
          ? "已用于优化学习排序"
          : "Learning ranking updated"
        : language === "zh"
          ? "已减少类似内容"
          : "Similar content will be reduced",
    );
  }

  function blockAuthor(author: string) {
    setPreferences((current) => ({
      ...current,
      blockedAuthors: current.blockedAuthors.includes(author)
        ? current.blockedAuthors
        : [...current.blockedAuthors, author],
    }));
    setToast(
      language === "zh"
        ? `已屏蔽 ${author}`
        : `${author} has been blocked`,
    );
  }

  function updatePreferences(next: AppPreferences) {
    setPreferences(next);
    setToast(
      language === "zh" ? "设置已更新" : "Preferences updated",
    );
  }

  function resetPreferences() {
    setPreferences(defaultPreferences);
    setToast(language === "zh" ? "已恢复默认设置" : "Preferences reset");
  }

  function addLearningList(imported: ImportedLearningList) {
    setLearningLists((current) => [
      imported,
      ...current.filter((item) => item.id !== imported.id),
    ]);
    setToast(
      language === "zh"
        ? `已导入「${imported.name}」`
        : `Imported “${imported.name}”`,
    );
  }

  async function importLearningRepository(url: string) {
    if (!window.studyflow || learningListImporting) return;
    setLearningListImporting(true);
    setLearningListError("");
    try {
      const imported = await window.studyflow.importGitHubLearningList(url);
      addLearningList(imported);
    } catch (reason) {
      setLearningListError(
        reason instanceof Error
          ? reason.message
          : language === "zh"
            ? "仓库导入失败"
            : "Repository import failed",
      );
    } finally {
      setLearningListImporting(false);
    }
  }

  async function importOfflineLearningList(file: File) {
    if (learningListImporting) return;
    if (file.size > MAX_LOCAL_IMPORT_BYTES) {
      setLearningListError(
        language === "zh"
          ? "学习清单不能超过 5 MB"
          : "Learning lists cannot exceed 5 MB",
      );
      return;
    }
    setLearningListImporting(true);
    setLearningListError("");
    try {
      const payload = JSON.parse(await file.text());
      const imported = normalizeOfflineLearningList(payload, file.name);
      addLearningList(imported);
    } catch (reason) {
      setLearningListError(
        reason instanceof Error
          ? reason.message
          : language === "zh"
            ? "本地清单加载失败"
            : "Unable to load the local learning list",
      );
    } finally {
      setLearningListImporting(false);
    }
  }

  function removeLearningList(id: string) {
    setLearningLists((current) => current.filter((list) => list.id !== id));
  }

  function openLearningLesson(
    list: ImportedLearningList,
    course: LearningCourse,
    section: LearningSection,
    lesson: LearningLesson,
  ) {
    const items = list.courses.flatMap((listCourse) =>
      listCourse.sections.flatMap((listSection) =>
        listSection.lessons.map((listLesson) => ({
          list,
          course: listCourse,
          section: listSection,
          lesson: listLesson,
        })),
      ),
    );
    const index = items.findIndex(
      (item) =>
        item.course.id === course.id &&
        item.section.id === section.id &&
        item.lesson.id === lesson.id,
    );
    openLearningPlaybackSession({ items, index: Math.max(0, index) });
  }

  function openLearningPlaybackSession(session: LearningPlaybackSession) {
    const current = session.items[session.index];
    if (!current) return;
    const { list, course, section, lesson } = current;
    const candidate: VideoCandidate = {
      id: `repo-${list.id}-${lesson.id}`,
      bvid: lesson.bvid,
      title: lesson.title,
      description:
        lesson.description ||
        `${course.title} · ${section.title} · ${list.name}`,
      cover: lesson.cover || course.cover || "",
      author: course.author || list.name,
      authorId: "",
      duration: lesson.duration,
      publishedAt: list.importedAt,
      views: 0,
      likes: 0,
      category: "学习清单",
      tags: [list.goal, course.title, section.title].filter(Boolean),
      position: 0,
      recommendReason: list.name,
      source: "bilibili",
    };
    openVideo(
      classifyVideo(
        candidate,
        preferences.mode,
        0,
        preferences.blockedAuthors,
        learningAffinityIndex,
      ),
      session,
    );
  }

  function openNextLearningLesson() {
    if (!learningPlaybackSession) return;
    const nextIndex = learningPlaybackSession.index + 1;
    if (nextIndex >= learningPlaybackSession.items.length) return;
    openLearningPlaybackSession({
      ...learningPlaybackSession,
      index: nextIndex,
    });
  }

  async function openOfficialLogin() {
    if (!window.studyflow) {
      setToast(
        language === "zh"
          ? "请通过桌面应用打开登录窗口"
          : "Open this in the desktop app to sign in",
      );
      return;
    }
    await window.studyflow.openOfficialLogin();
  }

  async function checkForUpdates() {
    if (!window.studyflow || updateBusy) return;
    setUpdateBusy(true);
    try {
      const state = await window.studyflow.checkForUpdates();
      setUpdateState(state);
      if (state.status === "not-available") {
        setToast(
          language === "zh"
            ? "当前已经是最新版本"
            : "You are already using the latest version",
        );
      }
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "Update check failed");
    } finally {
      setUpdateBusy(false);
    }
  }

  async function downloadUpdate() {
    if (!window.studyflow || updateBusy) return;
    setUpdateBusy(true);
    try {
      const state = await window.studyflow.downloadUpdate();
      setUpdateState(state);
    } catch (reason) {
      setToast(
        reason instanceof Error ? reason.message : "Update download failed",
      );
    } finally {
      setUpdateBusy(false);
    }
  }

  async function installUpdate() {
    if (!window.studyflow || updateBusy) return;
    setUpdateBusy(true);
    try {
      await window.studyflow.installUpdate();
    } catch (reason) {
      setToast(
        reason instanceof Error ? reason.message : "Update install failed",
      );
      setUpdateBusy(false);
    }
  }

  const page = screen === "creator" ? (
    <CreatorModePage
      language={language}
      loginState={loginState}
      project={creatorProject}
      searchRequest={creatorSearchRequest}
      progressByPart={playbackProgress}
      danmakuEnabled={preferences.danmakuEnabled}
      volumePreference={preferences.playerVolume}
      ratePreference={preferences.playbackRate}
      qualityPreference={preferences.preferredQuality}
      miniPlayerActive={miniPlayerActive}
      onProjectChange={setCreatorProject}
      onToggleDanmaku={() =>
        setPreferences((current) => ({
          ...current,
          danmakuEnabled: !current.danmakuEnabled,
        }))
      }
      onVolumeChange={(value) =>
        setPreferences((current) => ({ ...current, playerVolume: value }))
      }
      onRateChange={(value) =>
        setPreferences((current) => ({ ...current, playbackRate: value }))
      }
      onQualityChange={(value) =>
        setPreferences((current) => ({
          ...current,
          preferredQuality: value,
        }))
      }
      onProgressChange={(progress) =>
        setPlaybackProgress((current) => ({
          ...current,
          [progress.key]: progress,
        }))
      }
      onWatchTime={addWatchTime}
      onToggleMiniPlayer={() =>
        window.studyflow?.setMiniPlayer(!miniPlayerActive)
      }
      onToast={setToast}
    />
  ) : selectedVideo ? (
    <VideoPage
      video={selectedVideo}
      related={related}
      language={language}
      saved={savedSet.has(videoKey(selectedVideo))}
      showScores={preferences.showScores}
      savedSet={savedSet}
      danmakuEnabled={preferences.danmakuEnabled}
      volumePreference={preferences.playerVolume}
      ratePreference={preferences.playbackRate}
      qualityPreference={preferences.preferredQuality}
      progressByPart={playbackProgress}
      miniPlayerActive={miniPlayerActive}
      learningSession={learningPlaybackSession}
      onBack={() => {
        setSelectedVideo(null);
        setLearningPlaybackSession(null);
      }}
      onSave={saveVideo}
      onFeedback={feedback}
      onBlockAuthor={blockAuthor}
      onOpen={openVideo}
      onToggleDanmaku={() =>
        setPreferences((current) => ({
          ...current,
          danmakuEnabled: !current.danmakuEnabled,
        }))
      }
      onVolumeChange={(value) =>
        setPreferences((current) => ({ ...current, playerVolume: value }))
      }
      onRateChange={(value) =>
        setPreferences((current) => ({ ...current, playbackRate: value }))
      }
      onQualityChange={(value) =>
        setPreferences((current) => ({
          ...current,
          preferredQuality: value,
        }))
      }
      onProgressChange={(progress) =>
        setPlaybackProgress((current) => ({
          ...current,
          [progress.key]: progress,
        }))
      }
      onWatchTime={addWatchTime}
      onToggleMiniPlayer={() =>
        window.studyflow?.setMiniPlayer(!miniPlayerActive)
      }
      onNextLearningLesson={openNextLearningLesson}
    />
  ) : screen === "search" ? (
    <SearchPage
      key={searchQuery}
      language={language}
      initialQuery={searchQuery}
      videos={classifiedSearch}
      loading={searchLoading}
      searched={searched}
      saved={savedSet}
      showScores={preferences.showScores}
      onSearch={search}
      onOpen={openVideo}
      onSave={saveVideo}
      onFeedback={feedback}
      onBlockAuthor={blockAuthor}
    />
  ) : screen === "settings" ? (
    <SettingsPage
      language={language}
      preferences={preferences}
      updateState={updateState}
      updateBusy={updateBusy}
      onChange={updatePreferences}
      onReset={resetPreferences}
      onCheckForUpdates={checkForUpdates}
      onDownloadUpdate={downloadUpdate}
      onInstallUpdate={installUpdate}
    />
  ) : screen === "lists" ? (
    <LearningListsPage
      language={language}
      lists={learningLists}
      importing={learningListImporting}
      error={learningListError}
      onImport={importLearningRepository}
      onImportLocal={importOfflineLearningList}
      onRefresh={(list) => importLearningRepository(list.manifestUrl)}
      onRemove={removeLearningList}
      onOpenCreator={() => navigate("creator")}
      onOpenLesson={openLearningLesson}
    />
  ) : screen === "library" || screen === "history" ? (
    <CollectionPage
      kind={screen}
      language={language}
      savedVideos={savedVideos}
      history={history}
      saved={savedSet}
      showScores={preferences.showScores}
      onOpen={openVideo}
      onSave={saveVideo}
      onFeedback={feedback}
      onBlockAuthor={blockAuthor}
      onOpenHistory={openHistoryEntry}
    />
  ) : (
    <FeedPage
      language={language}
      mode={preferences.mode}
      allVideos={classifiedFeed}
      visibleVideos={visibleFeed}
      rawCount={classifiedFeed.length}
      historyCount={history.length}
      selectedSubject={selectedSubject}
      enabledSubjects={enabledSubjects}
      loading={feedLoading}
      liveSource={liveSource}
      warning={
        warning || (needsLearningSupplement ? "supplement" : "")
      }
      saved={savedSet}
      showScores={preferences.showScores}
      semanticStatus={semanticStatus}
      onSelectSubject={setSelectedSubject}
      onSetMode={(mode) => setPreferences((current) => ({ ...current, mode }))}
      onRefresh={() => loadFeed(true)}
      onOpen={openVideo}
      onSave={saveVideo}
      onFeedback={feedback}
      onBlockAuthor={blockAuthor}
    />
  );

  return (
    <div
      className={
        miniPlayerActive ? "app-shell mini-player-mode" : "app-shell"
      }
    >
      <TitleBar
        language={language}
        loginState={loginState}
        creatorMode={screen === "creator"}
        theme={preferences.theme}
        onHome={() => navigate("home")}
        onToggleMode={() =>
          navigate(screen === "creator" ? "home" : "creator")
        }
        onToggleTheme={() =>
          setPreferences((current) => ({
            ...current,
            theme: current.theme === "dark" ? "light" : "dark",
          }))
        }
        onLogin={() => setAuthOpen(true)}
        onSearch={searchFromHeader}
        onToggleLanguage={() =>
          setPreferences((current) => ({
            ...current,
            language: current.language === "zh" ? "en" : "zh",
          }))
        }
      />
      <div className="app-body">
        <Sidebar
          language={language}
          screen={screen}
          loginState={loginState}
          customText={preferences.sidebarCustomText}
          collapsed={screen === "creator"}
          onNavigate={navigate}
          onLogin={() => setAuthOpen(true)}
        />
        <main
          className={
            screen === "creator"
              ? "main-scroll creator-mode-main"
              : "main-scroll"
          }
        >
          <div
            key={screen}
            className={
              screen === "creator"
                ? "page-stage creator-stage"
                : "page-stage learning-stage"
            }
          >
            {page}
          </div>
        </main>
      </div>

      {authOpen && (
        <AuthModal
          language={language}
          loginState={loginState}
          watchTimeSeconds={watchTimeSeconds}
          onClose={() => setAuthOpen(false)}
          onOpenLogin={openOfficialLogin}
        />
      )}

      {hydrationReminderOpen && (
        <aside
          className="hydration-reminder"
          role="status"
          aria-live="polite"
        >
          <span className="hydration-reminder-icon">
            <Droplets size={20} />
          </span>
          <div>
            <strong>
              {language === "zh" ? "该喝水了" : "Time to drink water"}
            </strong>
            <p>
              {language === "zh"
                ? "站起来喝口水，顺便活动一下眼睛和肩颈。"
                : "Take a sip, stretch, and give your eyes a short break."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHydrationReminderOpen(false)}
            aria-label={language === "zh" ? "关闭提醒" : "Dismiss reminder"}
          >
            <X size={16} />
          </button>
        </aside>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
