export type Language = "zh" | "en";
export type ThemeMode = "dark" | "light";
export type LearningMode = "focus" | "balanced" | "explore";
export type Screen =
  | "home"
  | "search"
  | "lists"
  | "creator"
  | "library"
  | "history"
  | "settings";

export type SubjectKey =
  | "programming"
  | "language"
  | "math"
  | "science"
  | "engineering"
  | "medicine"
  | "law"
  | "politics"
  | "humanities"
  | "business"
  | "exam"
  | "career"
  | "general";

export interface VideoCandidate {
  id: string;
  bvid: string;
  title: string;
  description: string;
  cover: string;
  author: string;
  authorId: string;
  authorAvatar?: string;
  duration: number;
  publishedAt: number;
  views: number;
  likes: number;
  category: string;
  tags: string[];
  position: number;
  recommendReason: string;
  source: "bilibili" | "demo";
}

export type VideoRoute = "learning" | "adjacent" | "entertainment" | "ad";

export interface ClassifiedVideo extends VideoCandidate {
  learningScore: number;
  subject: SubjectKey;
  topics?: SubjectKey[];
  route: VideoRoute;
  reasons: string[];
  hidden: boolean;
  feedback: number;
}

export interface SubtitleCue {
  from: number;
  to: number;
  text: string;
}

export interface SubtitleTrack {
  language: string;
  label: string;
  cues: SubtitleCue[];
}

export interface SubtitleResult {
  bvid: string;
  cid: number;
  tracks: SubtitleTrack[];
  hasSubtitles: boolean;
}

export interface LoginState {
  loggedIn: boolean;
  userId: string | null;
  userName: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
}

export interface AppPreferences {
  language: Language;
  theme: ThemeMode;
  mode: LearningMode;
  hideAds: boolean;
  showScores: boolean;
  danmakuEnabled: boolean;
  playerVolume: number;
  playbackRate: number;
  preferredQuality: number | null;
  blockedAuthors: string[];
  enabledSubjects: SubjectKey[];
  sidebarCustomText: string;
  screenshotDirectory: string;
}

export interface StudyHistory {
  bvid: string;
  title: string;
  cover: string;
  author: string;
  subject: SubjectKey;
  watchedAt: number;
}

export interface PlaybackVideoTrack {
  id: string;
  url: string;
  backupUrls: string[];
  quality: number;
  codec: string;
  width: number;
  height: number;
  frameRate: string;
  bandwidth: number;
}

export interface PlaybackAudioTrack {
  id: string;
  url: string;
  backupUrls: string[];
  codec: string;
  bandwidth: number;
}

export interface PlaybackData {
  bvid: string;
  cid: number;
  duration: number;
  acceptQuality: number[];
  videoTracks: PlaybackVideoTrack[];
  audioTrack: PlaybackAudioTrack | null;
}

export interface DanmakuCue {
  id: string;
  time: number;
  mode: number;
  color: string;
  text: string;
}

export type UpdateStatus =
  | "idle"
  | "disabled"
  | "not-configured"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  percent: number;
  message: string;
  repository: string;
  releasesUrl: string;
  checkedAt: number | null;
}

export interface VideoComment {
  id: string;
  author: string;
  avatar: string;
  content: string;
  emojis: Record<string, string>;
  likeCount: number;
  replyCount: number;
  createdAt: number;
  replies: VideoComment[];
}

export interface VideoCommentPage {
  comments: VideoComment[];
  page: number;
  total: number;
  hasMore: boolean;
}

export interface VideoReplyPage {
  replies: VideoComment[];
  page: number;
  total: number;
  hasMore: boolean;
}

export interface PlaybackProgress {
  key: string;
  bvid: string;
  cid: number;
  currentTime: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

export interface CollectionVariant {
  id: string;
  cid: number;
  title: string;
  duration: number;
}

export interface CollectionEpisode {
  id: string;
  bvid: string;
  cid: number | null;
  title: string;
  duration: number;
  cover: string;
  index: number;
  variants: CollectionVariant[];
}

export interface CollectionSection {
  id: string;
  title: string;
  episodes: CollectionEpisode[];
}

export interface VideoCollection {
  id: string;
  title: string;
  cover: string;
  kind: "multi-part" | "ugc-season";
  total: number;
  sections: CollectionSection[];
}

export interface LearningLesson {
  id: string;
  title: string;
  bvid: string;
  cid: number | null;
  page: number | null;
  url: string;
  duration: number;
  cover: string;
  description: string;
  collectionId?: string;
  collectionTitle?: string;
  collectionCover?: string;
  inclusion: "full" | "segments";
  segments: LearningSegment[];
}

export interface LearningSegment {
  id: string;
  start: number;
  end: number;
  title: string;
}

export interface LearningSection {
  id: string;
  title: string;
  lessons: LearningLesson[];
}

export interface LearningCourse {
  id: string;
  title: string;
  description: string;
  cover: string;
  author: string;
  sections: LearningSection[];
}

export interface ImportedLearningList {
  id: string;
  name: string;
  description: string;
  goal: string;
  author?: string;
  createdAt?: string;
  courses: LearningCourse[];
  sourceUrl: string;
  manifestUrl: string;
  repository: string;
  source?: "github" | "local";
  importedAt: number;
}

export interface CreatorProject {
  version: 1;
  name: string;
  description: string;
  goal: string;
  author: string;
  createdAt: string;
  courses: LearningCourse[];
}

export interface LearningPlaybackSession {
  items: {
    list: ImportedLearningList;
    course: LearningCourse;
    section: LearningSection;
    lesson: LearningLesson;
  }[];
  index: number;
}

export interface DesktopApi {
  loadPersistentItem: (key: string) => Promise<unknown>;
  savePersistentItem: (
    key: string,
    value: unknown,
  ) => Promise<{ bytes: number; savedAt: number }>;
  getRecommendations: (force?: boolean) => Promise<{
    items: VideoCandidate[];
    cached?: boolean;
    warning?: string;
  }>;
  searchVideos: (
    keyword: string,
    page?: number,
  ) => Promise<{ items: VideoCandidate[]; cached?: boolean }>;
  getLoginState: () => Promise<LoginState>;
  openOfficialLogin: () => Promise<{ opened: boolean }>;
  getSubtitles: (bvid: string, cid?: number) => Promise<SubtitleResult>;
  getPlayback: (bvid: string, cid?: number) => Promise<PlaybackData>;
  getDanmaku: (bvid: string, cid?: number) => Promise<DanmakuCue[]>;
  getVideoComments: (
    bvid: string,
    page?: number,
    pageSize?: number,
  ) => Promise<VideoCommentPage>;
  getCommentReplies: (
    bvid: string,
    root: string,
    page?: number,
  ) => Promise<VideoReplyPage>;
  getVideoCollection: (bvid: string) => Promise<VideoCollection | null>;
  importGitHubLearningList: (url: string) => Promise<ImportedLearningList>;
  setPlaybackActive: (active: boolean) => void;
  setMiniPlayer: (active: boolean) => void;
  openExternal: (url: string) => Promise<void>;
  openNoteLink: (url: string) => Promise<void>;
  openCreatorStudio: () => Promise<boolean>;
  creatorSearchVideos: (keyword: string) => Promise<{
    id: string;
    bvid: string;
    title: string;
    author: string;
    duration: number;
    cover: string;
    views: number;
    description: string;
  }[]>;
  creatorGetVideoParts: (bvid: string) => Promise<{
    bvid: string;
    title: string;
    author: string;
    cover: string;
    pages: {
      cid: number;
      page: number;
      title: string;
      duration: number;
    }[];
  }>;
  creatorSaveToken: (token: string) => Promise<{
    login: string;
    avatarUrl: string;
  }>;
  creatorGetAuthState: () => Promise<{
    authenticated: boolean;
    login?: string;
    avatarUrl?: string;
  }>;
  creatorClearToken: () => Promise<boolean>;
  creatorPublish: (payload: {
    repository: string;
    branch: string;
    manifestPath: string;
    createRepository: boolean;
    private: boolean;
    project: CreatorProject;
  }) => Promise<{
    created: boolean;
    owner: string;
    repository: string;
    branch: string;
    repositoryUrl: string;
    manifestUrl: string;
    commitUrl: string;
  }>;
  chooseScreenshotDirectory: (currentDirectory: string) => Promise<string | null>;
  getScreenshotDirectory: () => Promise<string>;
  savePlayerScreenshot: (payload: {
    rect: { x: number; y: number; width: number; height: number };
    folderName: string;
    fileBase: string;
  }) => Promise<{ path: string }>;
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: () => Promise<UpdateState>;
  downloadUpdate: () => Promise<UpdateState>;
  installUpdate: () => Promise<boolean>;
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  closeWindow: () => void;
  onLoginChanged: (callback: (state: LoginState) => void) => () => void;
  onMiniPlayerChanged: (callback: (active: boolean) => void) => () => void;
  onOpenCreatorMode: (callback: () => void) => () => void;
  onUpdateChanged: (callback: (state: UpdateState) => void) => () => void;
}

declare global {
  interface Window {
    studyflow?: DesktopApi;
  }
}
