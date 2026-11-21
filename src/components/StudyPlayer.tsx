import {
  AlertTriangle,
  Camera,
  Check,
  ChevronUp,
  Gauge,
  LoaderCircle,
  Maximize,
  MessageSquareText,
  MessageSquareOff,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  ClassifiedVideo,
  DanmakuCue,
  Language,
  LearningLesson,
  PlaybackData,
  PlaybackProgress,
  PlaybackVideoTrack,
} from "../types";
import { formatDuration } from "../lib/format";
import { resolveSegmentPosition as resolveLearningSegmentPosition } from "../lib/segments";

interface StudyPlayerProps {
  video: ClassifiedVideo;
  cid?: number;
  language: Language;
  danmakuEnabled: boolean;
  volumePreference: number;
  ratePreference: number;
  qualityPreference: number | null;
  progressByPart: Record<string, PlaybackProgress>;
  miniPlayerActive: boolean;
  allowScreenshots?: boolean;
  collectionTitle?: string;
  partLabel?: string;
  timelineOffset?: number;
  timelineDuration?: number;
  initialTimelineSeek?: number | null;
  autoPlay?: boolean;
  playlistOverlay?: ReactNode;
  segmentPlan?: LearningLesson | null;
  onToggleDanmaku: () => void;
  onVolumeChange: (value: number) => void;
  onRateChange: (value: number) => void;
  onQualityChange: (value: number) => void;
  onProgressChange: (progress: PlaybackProgress) => void;
  onTimelineSeek?: (position: number, autoPlay: boolean) => void;
  onScreenshotModeChange?: (active: boolean) => void;
  onControlsVisibilityChange?: (visible: boolean) => void;
  onToggleMiniPlayer: () => void;
  onWatchTime?: (seconds: number) => void;
  onEnded: () => void;
}

interface ActiveDanmaku extends DanmakuCue {
  instanceId: string;
  lane: number;
  duration: number;
}

const qualityNames: Record<number, string> = {
  127: "8K",
  126: "Dolby",
  125: "HDR",
  120: "4K",
  116: "1080P60",
  112: "1080P+",
  80: "1080P",
  74: "720P60",
  64: "720P",
  32: "480P",
  16: "360P",
};
const CONTROLS_AUTO_HIDE_MS = 3000;

function qualityLabel(track: PlaybackVideoTrack) {
  const name = qualityNames[track.quality] || `${track.height}P`;
  return track.frameRate.includes("60") ? `${name} 60fps` : name;
}

function danmakuHash(value: string) {
  return Array.from(value).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
}

export function StudyPlayer({
  video,
  cid,
  language,
  danmakuEnabled,
  volumePreference,
  ratePreference,
  qualityPreference,
  progressByPart,
  miniPlayerActive,
  allowScreenshots = false,
  collectionTitle,
  partLabel,
  timelineOffset = 0,
  timelineDuration = 0,
  initialTimelineSeek = null,
  autoPlay = false,
  playlistOverlay,
  segmentPlan,
  onToggleDanmaku,
  onVolumeChange,
  onRateChange,
  onQualityChange,
  onProgressChange,
  onTimelineSeek,
  onScreenshotModeChange,
  onControlsVisibilityChange,
  onToggleMiniPlayer,
  onWatchTime,
  onEnded,
}: StudyPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const lastDanmakuTime = useRef(0);
  const lastProgressSave = useRef(0);
  const resumeTime = useRef<number | null>(null);
  const resumeApplied = useRef(false);
  const autoPlayApplied = useRef(false);
  const currentTimeRef = useRef(0);
  const pendingSeekTime = useRef<number | null>(null);
  const durationRef = useRef(0);
  const onEndedRef = useRef(onEnded);
  const [playback, setPlayback] = useState<PlaybackData | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [videoSource, setVideoSource] = useState("");
  const [audioSource, setAudioSource] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(volumePreference);
  const [muted, setMuted] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(ratePreference);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [segmentMode, setSegmentMode] = useState(true);
  const [danmaku, setDanmaku] = useState<DanmakuCue[]>([]);
  const [activeDanmaku, setActiveDanmaku] = useState<ActiveDanmaku[]>([]);
  const [error, setError] = useState("");
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [videoFrameVisible, setVideoFrameVisible] = useState(false);
  const [screenshotNotice, setScreenshotNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const screenshotNoticeTimer = useRef<number | null>(null);
  const segmentEnded = useRef(false);
  const lastAudioRecovery = useRef(0);
  const fullscreenChanging = useRef(false);
  const videoFrameReady = useRef(false);
  const videoFrameRequest = useRef<number | null>(null);
  const videoFrameFallbackTimer = useRef<number | null>(null);
  const failedVideoTrackIds = useRef<Set<string>>(new Set());
  const failedVideoUrls = useRef<Set<string>>(new Set());
  const failedAudioUrls = useRef<Set<string>>(new Set());
  const switchingVideoTrack = useRef(false);
  const loadRequestId = useRef(0);
  const resumeAfterTrackSwitch = useRef(false);
  const watchTimeCallback = useRef(onWatchTime);
  const watchTimeAccumulator = useRef(0);
  const watchTimeLastTick = useRef<number | null>(null);
  const videoBuffering = useRef(false);
  const shortcutActionsRef = useRef({
    togglePlayback: () => {},
    seek: (_time: number) => {},
  });
  const controlsHideTimer = useRef<number | null>(null);

  const selectedTrack =
    playback?.videoTracks.find((track) => track.id === selectedTrackId) ||
    playback?.videoTracks[0] ||
    null;
  const selectedTrackUrls = selectedTrack
    ? [selectedTrack.url, ...(selectedTrack.backupUrls || [])].filter(Boolean)
    : [];
  const selectedAudioUrls = playback?.audioTrack
    ? [playback.audioTrack.url, ...(playback.audioTrack.backupUrls || [])].filter(
        Boolean,
      )
    : [];

  const planSegments =
    segmentPlan?.inclusion === "segments"
      ? [...segmentPlan.segments]
          .filter((segment) => segment.end > segment.start)
          .sort((left, right) => left.start - right.start)
      : [];

  async function loadPlayback() {
    const requestId = ++loadRequestId.current;
    if (!window.studyflow) {
      setError("Desktop API unavailable");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const result = await window.studyflow.getPlayback(video.bvid, cid);
      if (requestId !== loadRequestId.current) return;
      if (result.videoTracks.length === 0) {
        throw new Error("No playable video stream");
      }
      const preferredTrack =
        result.videoTracks.find(
          (track) => track.quality === qualityPreference,
        ) || result.videoTracks[0];
      const savedProgress = progressByPart[`${video.bvid}:${result.cid}`];
      resumeTime.current =
        savedProgress &&
        !savedProgress.completed &&
        savedProgress.currentTime > 5
          ? savedProgress.currentTime
          : null;
      resumeApplied.current = false;
      setPlayback(result);
      setSelectedTrackId(preferredTrack.id);
      setVideoSource(preferredTrack.url);
      setAudioSource(result.audioTrack?.url || "");
      setDuration(result.duration || video.duration);
      setStatus("ready");
    } catch (reason) {
      if (requestId !== loadRequestId.current) return;
      setError(
        reason instanceof Error ? reason.message : "Unable to load video",
      );
      setStatus("error");
    }
  }

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    watchTimeCallback.current = onWatchTime;
  }, [onWatchTime]);

  useEffect(() => {
    setPlayback(null);
    setPlaying(false);
    setCurrentTime(0);
    setActiveDanmaku([]);
    videoFrameReady.current = false;
    setVideoFrameVisible(false);
    pendingSeekTime.current = null;
    failedVideoTrackIds.current.clear();
    failedVideoUrls.current.clear();
    failedAudioUrls.current.clear();
    lastDanmakuTime.current = 0;
    lastProgressSave.current = 0;
    segmentEnded.current = false;
    setSegmentMode(true);
    loadPlayback();

    let cancelled = false;
    if (window.studyflow && video.bvid) {
      window.studyflow
        .getDanmaku(video.bvid, cid)
        .then((cues) => {
          if (!cancelled) setDanmaku(cues);
        })
        .catch(() => {
          if (!cancelled) setDanmaku([]);
        });
    }
    return () => {
      loadRequestId.current += 1;
      cancelled = true;
    };
  }, [video.bvid, cid]);

  useEffect(() => {
    failedVideoUrls.current.clear();
    setVideoSource(selectedTrack?.url || "");
  }, [selectedTrack?.id]);

  useEffect(() => {
    failedAudioUrls.current.clear();
    setAudioSource(playback?.audioTrack?.url || "");
  }, [playback?.audioTrack?.id]);

  useEffect(() => {
    videoFrameReady.current = false;
    setVideoFrameVisible(false);
    if (
      videoFrameRequest.current !== null &&
      "cancelVideoFrameCallback" in HTMLVideoElement.prototype
    ) {
      videoRef.current?.cancelVideoFrameCallback(videoFrameRequest.current);
    }
    videoFrameRequest.current = null;
    if (videoFrameFallbackTimer.current) {
      window.clearTimeout(videoFrameFallbackTimer.current);
      videoFrameFallbackTimer.current = null;
    }
    audioRef.current?.pause();
  }, [selectedTrackId]);

  useEffect(() => {
    segmentEnded.current = false;
    setSegmentMode(planSegments.length > 0);
  }, [video.bvid, cid, segmentPlan?.inclusion, segmentPlan?.segments]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
    if (playing) ensureAudioPlayback(true);
  }, [volume, muted]);

  useEffect(() => {
    function flushWatchTime() {
      const seconds = watchTimeAccumulator.current;
      watchTimeAccumulator.current = 0;
      if (seconds > 0.1) watchTimeCallback.current?.(seconds);
    }

    if (!playing) {
      watchTimeLastTick.current = null;
      flushWatchTime();
      return;
    }

    watchTimeLastTick.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const previous = watchTimeLastTick.current;
      watchTimeLastTick.current = now;
      if (previous === null) return;
      const videoElement = videoRef.current;
      if (
        !videoElement ||
        videoElement.paused ||
        videoElement.seeking ||
        videoElement.readyState < 2 ||
        videoBuffering.current ||
        !videoFrameReady.current
      ) {
        return;
      }
      watchTimeAccumulator.current += Math.min(1.5, (now - previous) / 1000);
      if (watchTimeAccumulator.current >= 5) {
        flushWatchTime();
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      watchTimeLastTick.current = null;
      flushWatchTime();
    };
  }, [playing]);

  useEffect(() => {
    setVolume(volumePreference);
  }, [volumePreference]);

  useEffect(() => {
    setPlaybackRate(ratePreference);
    if (videoRef.current) videoRef.current.playbackRate = ratePreference;
    if (audioRef.current) audioRef.current.playbackRate = ratePreference;
  }, [ratePreference, playback]);

  useEffect(() => {
    showPlayerControls();
    return () => {
      if (controlsHideTimer.current) {
        window.clearTimeout(controlsHideTimer.current);
        controlsHideTimer.current = null;
      }
    };
  }, [playing, qualityOpen, rateOpen]);

  useEffect(() => {
    onControlsVisibilityChange?.(controlsVisible);
  }, [controlsVisible, onControlsVisibilityChange]);

  function showPlayerControls() {
    setControlsVisible(true);
    if (controlsHideTimer.current) {
      window.clearTimeout(controlsHideTimer.current);
      controlsHideTimer.current = null;
    }
    if (!playing || qualityOpen || rateOpen) return;
    controlsHideTimer.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsHideTimer.current = null;
    }, CONTROLS_AUTO_HIDE_MS);
  }

  useEffect(() => {
    const mediaSession = navigator.mediaSession;
    if (!mediaSession) return;
    mediaSession.metadata = new MediaMetadata({
      title: video.title,
      artist: video.author,
      album: "BiliBili Learning Version",
      artwork: video.cover
        ? [{ src: video.cover, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });
    mediaSession.setActionHandler("play", () => {
      if (videoRef.current?.paused) void togglePlayback();
    });
    mediaSession.setActionHandler("pause", () => {
      if (!videoRef.current?.paused) {
        videoRef.current?.pause();
        audioRef.current?.pause();
      }
    });
    mediaSession.setActionHandler("seekbackward", (details) => {
      seek(currentTimeRef.current - (details.seekOffset || 10));
    });
    mediaSession.setActionHandler("seekforward", (details) => {
      seek(currentTimeRef.current + (details.seekOffset || 10));
    });
    mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) seek(details.seekTime);
    });
    mediaSession.setActionHandler("nexttrack", () => onEndedRef.current());

    return () => {
      mediaSession.setActionHandler("play", null);
      mediaSession.setActionHandler("pause", null);
      mediaSession.setActionHandler("seekbackward", null);
      mediaSession.setActionHandler("seekforward", null);
      mediaSession.setActionHandler("seekto", null);
      mediaSession.setActionHandler("nexttrack", null);
    };
  }, [video.title, video.author, video.cover]);

  useEffect(() => {
    if (navigator.mediaSession) {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    }
  }, [playing]);

  useEffect(() => {
    window.studyflow?.setPlaybackActive(playing);
  }, [playing]);

  useEffect(
    () => () => {
      window.studyflow?.setPlaybackActive(false);
    },
    [],
  );

  useEffect(() => {
    onScreenshotModeChange?.(capturingScreenshot);
  }, [capturingScreenshot, onScreenshotModeChange]);

  useEffect(() => {
    if (!danmakuEnabled) {
      setActiveDanmaku([]);
    }
  }, [danmakuEnabled]);

  useEffect(() => {
    if (!danmakuEnabled || !playing || danmaku.length === 0) return;
    if (currentTime < lastDanmakuTime.current - 1) {
      lastDanmakuTime.current = currentTime;
      setActiveDanmaku([]);
      return;
    }
    const due = danmaku
      .filter(
        (cue) =>
          cue.time > lastDanmakuTime.current &&
          cue.time <= currentTime + 0.15,
      )
      .slice(0, 12);
    lastDanmakuTime.current = currentTime;
    if (due.length === 0) return;

    const stamp = Date.now();
    const additions = due.map((cue, index): ActiveDanmaku => {
      const hash = danmakuHash(cue.id);
      return {
        ...cue,
        instanceId: `${stamp}-${index}-${cue.id}`,
        lane: hash % 8,
        duration: 8 + (hash % 24) / 10,
      };
    });
    setActiveDanmaku((current) => [...current, ...additions].slice(-320));

  }, [currentTime, danmaku, danmakuEnabled, playing]);

  function syncAudio() {
    const videoElement = videoRef.current;
    const audioElement = audioRef.current;
    if (!videoElement || !audioElement) return;
    if (Math.abs(audioElement.currentTime - videoElement.currentTime) > 0.28) {
      audioElement.currentTime = videoElement.currentTime;
    }
  }

  function clearVideoFrameGate() {
    if (
      videoFrameRequest.current !== null &&
      "cancelVideoFrameCallback" in HTMLVideoElement.prototype
    ) {
      videoRef.current?.cancelVideoFrameCallback(videoFrameRequest.current);
    }
    videoFrameRequest.current = null;
    if (videoFrameFallbackTimer.current) {
      window.clearTimeout(videoFrameFallbackTimer.current);
      videoFrameFallbackTimer.current = null;
    }
  }

  function prepareTrackSwitch() {
    const wasPlaying = Boolean(videoRef.current && !videoRef.current.paused);
    resumeAfterTrackSwitch.current = wasPlaying;
    resumeTime.current = currentTimeRef.current;
    resumeApplied.current = false;
    pendingSeekTime.current = currentTimeRef.current;
    audioRef.current?.pause();
    videoFrameReady.current = false;
    setVideoFrameVisible(false);
    clearVideoFrameGate();
  }

  function retryVideoBackupUrl() {
    const nextUrl = selectedTrackUrls.find(
      (url) => url !== videoSource && !failedVideoUrls.current.has(url),
    );
    if (!nextUrl) return false;
    if (videoSource) failedVideoUrls.current.add(videoSource);
    prepareTrackSwitch();
    setVideoSource(nextUrl);
    window.setTimeout(() => videoRef.current?.load(), 0);
    return true;
  }

  function recoverAudio(reason: string) {
    const currentUrl =
      audioRef.current?.currentSrc || audioRef.current?.src || audioSource;
    const nextUrl = selectedAudioUrls.find(
      (url) => url !== currentUrl && !failedAudioUrls.current.has(url),
    );
    if (nextUrl) {
      if (currentUrl) failedAudioUrls.current.add(currentUrl);
      setAudioSource(nextUrl);
      window.setTimeout(() => {
        audioRef.current?.load();
        if (playing) {
          void audioRef.current?.play().catch(() => undefined);
        }
      }, 0);
      return true;
    }
    videoRef.current?.pause();
    setPlaying(false);
    setError(reason);
    setStatus("error");
    return false;
  }

  function switchToFallbackVideoTrack(reason: string) {
    if (!playback || !selectedTrack || switchingVideoTrack.current) return;
    if (retryVideoBackupUrl()) return;
    switchingVideoTrack.current = true;
    failedVideoTrackIds.current.add(selectedTrack.id);
    prepareTrackSwitch();

    const fallback = playback.videoTracks.find(
      (track) =>
        track.id !== selectedTrack.id &&
        !failedVideoTrackIds.current.has(track.id),
    );
    if (fallback) {
      setSelectedTrackId(fallback.id);
      onQualityChange(fallback.quality);
      window.setTimeout(() => {
        switchingVideoTrack.current = false;
        videoRef.current?.load();
      }, 0);
      return;
    }

    switchingVideoTrack.current = false;
    setError(reason);
    setStatus("error");
  }

  function gateAudioOnFirstVideoFrame() {
    const videoElement = videoRef.current;
    if (!videoElement || videoElement.paused) return;
    if (videoFrameReady.current) {
      ensureAudioPlayback(true);
      return;
    }

    clearVideoFrameGate();
    const finish = () => {
      videoFrameRequest.current = null;
      if (videoFrameFallbackTimer.current) {
        window.clearTimeout(videoFrameFallbackTimer.current);
        videoFrameFallbackTimer.current = null;
      }
      if (!videoRef.current?.paused) {
        videoFrameReady.current = true;
        setVideoFrameVisible(true);
        ensureAudioPlayback(true);
      }
    };

    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      videoFrameRequest.current =
        videoElement.requestVideoFrameCallback(finish);
    } else {
      window.setTimeout(finish, 80);
    }

    videoFrameFallbackTimer.current = window.setTimeout(() => {
      if (videoFrameReady.current || videoRef.current?.paused) return;
      switchToFallbackVideoTrack(
        language === "zh"
          ? "当前视频轨道没有输出画面，已尝试其他可用清晰度。"
          : "This video track did not render any frames. Another available quality was tried.",
      );
    }, 3200);
  }

  function ensureAudioPlayback(force = false) {
    const videoElement = videoRef.current;
    const audioElement = audioRef.current;
    if (
      !videoElement ||
      !audioElement ||
      videoElement.paused ||
      !videoFrameReady.current ||
      muted ||
      volume <= 0
    ) {
      return;
    }
    audioElement.volume = volume;
    audioElement.muted = false;
    if (!audioElement.paused) return;
    if (!force && Date.now() - lastAudioRecovery.current < 1200) return;
    lastAudioRecovery.current = Date.now();
    void audioElement.play().catch((reason) => {
      if (
        reason?.name === "NotSupportedError" ||
        reason?.name === "AbortError"
      ) {
        recoverAudio(
          language === "zh" ? "音频轨道加载失败" : "The audio track failed to load",
        );
      }
    });
  }

  function persistProgress(completed = false) {
    const videoElement = videoRef.current;
    if (!videoElement || !playback) return;
    const total = videoElement.duration || duration || playback.duration;
    if (!Number.isFinite(total) || total <= 0) return;
    const position = completed
      ? total
      : Math.max(0, Math.min(videoElement.currentTime, total));
    if (position < 1 && !completed) return;
    onProgressChange({
      key: `${playback.bvid}:${playback.cid}`,
      bvid: playback.bvid,
      cid: playback.cid,
      currentTime: position,
      duration: total,
      completed: completed || position >= total - 8,
      updatedAt: Date.now(),
    });
    lastProgressSave.current = Date.now();
  }

  function applySegmentBoundary(position: number) {
    const decision = resolveLearningSegmentPosition(
      position,
      planSegments,
      segmentMode,
    );
    if (decision.ended) {
      const videoElement = videoRef.current;
      const lastEnd = decision.target;
      videoElement?.pause();
      audioRef.current?.pause();
      if (videoElement) videoElement.currentTime = lastEnd;
      if (audioRef.current) audioRef.current.currentTime = lastEnd;
      currentTimeRef.current = lastEnd;
      setCurrentTime(lastEnd);
      persistProgress(true);
      if (!segmentEnded.current) {
        segmentEnded.current = true;
        onEndedRef.current();
      }
      return true;
    }
    if (Math.abs(decision.target - position) > 0.08) {
      if (videoRef.current) videoRef.current.currentTime = decision.target;
      if (audioRef.current) audioRef.current.currentTime = decision.target;
      currentTimeRef.current = decision.target;
      setCurrentTime(decision.target);
      return true;
    }
    return false;
  }

  function updatePositionState(position: number, total: number) {
    const combinedDuration =
      timelineDuration > 0 ? timelineDuration : Math.max(total, 0);
    const combinedPosition = timelineOffset + position;
    if (
      !navigator.mediaSession ||
      !combinedDuration ||
      !Number.isFinite(combinedDuration)
    ) {
      return;
    }
    try {
      navigator.mediaSession.setPositionState({
        duration: combinedDuration,
        playbackRate: playbackRate || 1,
        position: Math.max(
          0,
          Math.min(combinedPosition, combinedDuration - 0.01),
        ),
      });
    } catch {
      // Some Chromium builds reject position updates before media is ready.
    }
  }

  async function togglePlayback() {
    const videoElement = videoRef.current;
    const audioElement = audioRef.current;
    if (!videoElement) return;
    if (videoElement.paused) {
      setPlaying(true);
      try {
        syncAudio();
        if (audioElement) {
          audioElement.volume = muted ? 0 : volume;
          audioElement.muted = false;
        }
        await videoElement.play();
        gateAudioOnFirstVideoFrame();
      } catch {
        setPlaying(false);
      }
    } else {
      videoElement.pause();
      audioElement?.pause();
    }
  }

  function seek(nextTime: number) {
    let target = Math.max(0, Math.min(nextTime, duration || 0));
    const decision = resolveLearningSegmentPosition(
      target,
      planSegments,
      segmentMode,
    );
    target = decision.target;
    pendingSeekTime.current = target;
    if (videoRef.current) videoRef.current.currentTime = target;
    if (audioRef.current) audioRef.current.currentTime = target;
    setCurrentTime(target);
    currentTimeRef.current = target;
    updatePositionState(target, durationRef.current || duration);
  }

  function seekTimeline(nextTime: number) {
    showPlayerControls();
    const target = Math.max(
      0,
      Math.min(
        nextTime,
        Math.max(0, (effectiveTimelineDuration || duration) - 0.1),
      ),
    );
    const localEnd = timelineOffset + duration;
    if (target >= timelineOffset && target < localEnd - 0.05) {
      seek(target - timelineOffset);
      return;
    }
    onTimelineSeek?.(target, playing);
  }

  function chooseTrack(track: PlaybackVideoTrack) {
    const resumeTime = videoRef.current?.currentTime || currentTime;
    setSelectedTrackId(track.id);
    setQualityOpen(false);
    onQualityChange(track.quality);
    window.setTimeout(() => seek(resumeTime), 80);
  }

  function chooseRate(rate: number) {
    setPlaybackRate(rate);
    setRateOpen(false);
    onRateChange(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
    if (audioRef.current) audioRef.current.playbackRate = rate;
    updatePositionState(currentTimeRef.current, durationRef.current || duration);
  }

  function toggleSegmentMode() {
    setSegmentMode((current) => {
      const next = !current;
      segmentEnded.current = false;
      if (next) {
        window.setTimeout(() => {
          applySegmentBoundary(videoRef.current?.currentTime || 0);
        }, 0);
      }
      return next;
    });
  }

  async function toggleFullscreen() {
    if (!playerRef.current || fullscreenChanging.current) return;
    const fullscreenTarget =
      playerRef.current.closest<HTMLElement>(".player-shell") ||
      playerRef.current;
    fullscreenChanging.current = true;
    try {
      const before = fullscreenTarget.getBoundingClientRect();
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await fullscreenTarget.requestFullscreen();
      }
      const after = fullscreenTarget.getBoundingClientRect();
      if (
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        before.width > 0 &&
        before.height > 0 &&
        after.width > 0 &&
        after.height > 0
      ) {
        fullscreenTarget.style.willChange = "transform, opacity";
        const animation = fullscreenTarget.animate(
          [
            {
              opacity: 0.9,
              transformOrigin: "top left",
              transform:
                `translate3d(${before.left - after.left}px, ` +
                `${before.top - after.top}px, 0) ` +
                `scale(${before.width / after.width}, ` +
                `${before.height / after.height})`,
            },
            {
              opacity: 1,
              transformOrigin: "top left",
              transform: "translate3d(0, 0, 0) scale(1, 1)",
            },
          ],
          {
            duration: 250,
            easing: "cubic-bezier(0.2, 0.74, 0.25, 1)",
            fill: "both",
          },
        );
        await animation.finished.catch(() => undefined);
        animation.cancel();
      }
    } catch {
      // Fullscreen can be rejected by the host window; leave playback intact.
    } finally {
      fullscreenTarget.style.willChange = "";
      fullscreenChanging.current = false;
    }
  }

  const effectiveTimelineDuration =
    timelineDuration > 0 ? timelineDuration : duration;
  const timelinePosition = timelineOffset + currentTime;
  const progressPercent =
    effectiveTimelineDuration > 0
      ? (timelinePosition / effectiveTimelineDuration) * 100
      : 0;

  useEffect(
    () => () => {
      if (screenshotNoticeTimer.current) {
        window.clearTimeout(screenshotNoticeTimer.current);
      }
      if (videoFrameFallbackTimer.current) {
        window.clearTimeout(videoFrameFallbackTimer.current);
      }
      if (
        videoFrameRequest.current !== null &&
        "cancelVideoFrameCallback" in HTMLVideoElement.prototype
      ) {
        videoRef.current?.cancelVideoFrameCallback(videoFrameRequest.current);
      }
    },
    [],
  );

  function screenshotTimeLabel(seconds: number) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;
    return [hours, minutes, remainingSeconds]
      .map((part) => String(part).padStart(2, "0"))
      .join("-");
  }

  async function captureScreenshot() {
    if (
      !allowScreenshots ||
      !window.studyflow ||
      !videoRef.current ||
      capturingScreenshot
    ) {
      return;
    }
    setCapturingScreenshot(true);
    if (screenshotNoticeTimer.current) {
      window.clearTimeout(screenshotNoticeTimer.current);
    }
    setScreenshotNotice(null);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 60));
      const rect = videoRef.current.getBoundingClientRect();
      const timeLabel = screenshotTimeLabel(currentTimeRef.current);
      const result = await window.studyflow.savePlayerScreenshot({
        rect: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
        folderName: collectionTitle?.trim() || video.title,
        fileBase: `${partLabel?.trim() || video.title}@${timeLabel}`,
      });
      setScreenshotNotice({
        type: "success",
        message:
          language === "zh"
            ? `截图已保存：${result.path}`
            : `Screenshot saved: ${result.path}`,
      });
    } catch (reason) {
      setScreenshotNotice({
        type: "error",
        message:
          reason instanceof Error
            ? reason.message
            : language === "zh"
              ? "截图保存失败"
              : "Failed to save screenshot",
      });
    } finally {
      setCapturingScreenshot(false);
      screenshotNoticeTimer.current = window.setTimeout(
        () => setScreenshotNotice(null),
        2600,
      );
    }
  }

  shortcutActionsRef.current = {
    togglePlayback: () => {
      void togglePlayback();
    },
    seek,
  };

  useEffect(() => {
    if (status !== "ready") return;
    const handlePlaybackShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, button, a, [contenteditable='true'], [role='textbox']",
        )
      ) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const modal = document.querySelector('[aria-modal="true"]');
      if (modal && !modal.contains(playerRef.current)) return;

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        if (!event.repeat) {
          showPlayerControls();
          shortcutActionsRef.current.togglePlayback();
        }
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        shortcutActionsRef.current.seek(currentTimeRef.current - 5);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        shortcutActionsRef.current.seek(currentTimeRef.current + 5);
      }
    };
    window.addEventListener("keydown", handlePlaybackShortcut);
    return () => window.removeEventListener("keydown", handlePlaybackShortcut);
  }, [status]);

  if (status === "loading") {
    return (
      <div className="study-player player-state">
        <LoaderCircle className="spin" size={28} />
        <span>{language === "zh" ? "正在准备视频流" : "Preparing video stream"}</span>
      </div>
    );
  }

  if (status === "error" || !playback || !selectedTrack) {
    return (
      <div className="study-player player-state error">
        <AlertTriangle size={28} />
        <strong>
          {language === "zh" ? "无法加载视频" : "Unable to load this video"}
        </strong>
        <span>{error}</span>
        <button type="button" onClick={loadPlayback}>
          <RotateCcw size={15} />
          {language === "zh" ? "重试" : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        [
          "study-player",
          capturingScreenshot ? "screenshot-capturing" : "",
          !controlsVisible ? "controls-hidden" : "",
        ]
          .filter(Boolean)
          .join(" ")
      }
      ref={playerRef}
      onPointerMove={showPlayerControls}
      onPointerDown={showPlayerControls}
      onFocusCapture={showPlayerControls}
    >
      {miniPlayerActive && (
        <div className="mini-player-drag" aria-hidden="true" />
      )}
      <video
        ref={videoRef}
        src={videoSource}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(event) => {
          videoFrameReady.current = false;
          setVideoFrameVisible(false);
          clearVideoFrameGate();
          const nextDuration =
            event.currentTarget.duration || playback.duration;
          setDuration(nextDuration);
          durationRef.current = nextDuration;
          event.currentTarget.playbackRate = playbackRate || 1;
          if (!resumeApplied.current) {
            const requestedSeek =
              pendingSeekTime.current ??
              (initialTimelineSeek === null
                ? null
                : Math.max(
                    0,
                    Math.min(
                      initialTimelineSeek - timelineOffset,
                      nextDuration,
                    ),
                  ));
            const resumeAt = requestedSeek ?? resumeTime.current;
            if (
              resumeAt &&
              Number.isFinite(resumeAt) &&
              resumeAt >= 0 &&
              resumeAt < nextDuration - 0.1
            ) {
              event.currentTarget.currentTime = resumeAt;
              if (audioRef.current) audioRef.current.currentTime = resumeAt;
              setCurrentTime(resumeAt);
              currentTimeRef.current = resumeAt;
            }
            pendingSeekTime.current = null;
            resumeApplied.current = true;
          }
          if (resumeAfterTrackSwitch.current) {
            resumeAfterTrackSwitch.current = false;
            window.setTimeout(() => {
              videoRef.current?.play().catch(() => undefined);
            }, 40);
          } else if (autoPlay && !autoPlayApplied.current) {
            autoPlayApplied.current = true;
            window.setTimeout(() => {
              videoRef.current?.play().catch(() => undefined);
            }, 40);
          }
          updatePositionState(
            event.currentTarget.currentTime,
            nextDuration,
          );
          applySegmentBoundary(event.currentTarget.currentTime);
        }}
        onTimeUpdate={(event) => {
          const position = event.currentTarget.currentTime;
          const pendingSeek = pendingSeekTime.current;
          if (
            pendingSeek !== null &&
            (event.currentTarget.seeking ||
              Math.abs(position - pendingSeek) > 0.5)
          ) {
            setCurrentTime(pendingSeek);
            currentTimeRef.current = pendingSeek;
            return;
          }
          if (applySegmentBoundary(position)) return;
          setCurrentTime(position);
          currentTimeRef.current = position;
          syncAudio();
          ensureAudioPlayback();
          updatePositionState(
            position,
            event.currentTarget.duration || duration || playback.duration,
          );
          if (Date.now() - lastProgressSave.current >= 3000) {
            persistProgress(false);
          }
        }}
        onPlay={() => {
          resumeAfterTrackSwitch.current = false;
          setPlaying(true);
          syncAudio();
        }}
        onPause={() => {
          setPlaying(false);
          videoBuffering.current = false;
          audioRef.current?.pause();
          persistProgress(false);
        }}
        onEnded={() => {
          setPlaying(false);
          audioRef.current?.pause();
          persistProgress(true);
          onEndedRef.current();
        }}
        onWaiting={() => {
          videoBuffering.current = true;
          watchTimeLastTick.current = performance.now();
          audioRef.current?.pause();
        }}
        onPlaying={() => {
          videoBuffering.current = false;
          watchTimeLastTick.current = performance.now();
          syncAudio();
          gateAudioOnFirstVideoFrame();
        }}
        onError={() =>
          switchToFallbackVideoTrack(
            language === "zh"
              ? "视频轨道加载或解码失败，已尝试其他可用清晰度。"
              : "The video track failed to load or decode. Another available quality was tried.",
          )
        }
        onRateChange={(event) => {
          if (audioRef.current) {
            audioRef.current.playbackRate = event.currentTarget.playbackRate;
          }
        }}
        onSeeked={() => {
          const position = videoRef.current?.currentTime || 0;
          pendingSeekTime.current = null;
          setCurrentTime(position);
          currentTimeRef.current = position;
          if (!applySegmentBoundary(position)) {
            persistProgress(false);
          }
        }}
        onClick={togglePlayback}
      />
      {playback.audioTrack && audioSource && (
        <audio
          ref={audioRef}
          src={audioSource}
          preload="auto"
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = playbackRate || 1;
            syncAudio();
            ensureAudioPlayback(true);
          }}
          onCanPlay={() => ensureAudioPlayback(true)}
          onError={() =>
            recoverAudio(
              language === "zh"
                ? "音频轨道加载失败"
                : "The audio track failed to load",
            )
          }
        />
      )}

      {playing && !videoFrameVisible && (
        <div className="player-frame-loading">
          <LoaderCircle className="spin" size={22} />
          <span>
            {language === "zh" ? "正在加载视频画面" : "Loading video frames"}
          </span>
        </div>
      )}

      {danmakuEnabled && (
        <div className="danmaku-layer" aria-hidden="true">
          {activeDanmaku.map((cue) => (
            <span
              key={cue.instanceId}
              className="danmaku-item"
              style={
                {
                  top: `${10 + cue.lane * 31}px`,
                  color: cue.color,
                  animationDuration: `${cue.duration}s`,
                  animationPlayState: playing ? "running" : "paused",
                } as CSSProperties
              }
              onAnimationEnd={() =>
                setActiveDanmaku((current) =>
                  current.filter((item) => item.instanceId !== cue.instanceId),
                )
              }
            >
              {cue.text}
            </span>
          ))}
        </div>
      )}

      {!playing && (
        <button
          className="player-center-play"
          type="button"
          onClick={togglePlayback}
          aria-label={language === "zh" ? "播放" : "Play"}
        >
          <Play size={27} fill="currentColor" />
        </button>
      )}

      {allowScreenshots && (
        <button
          type="button"
          className="player-screenshot-button"
          onClick={captureScreenshot}
          disabled={capturingScreenshot}
          title={language === "zh" ? "一键截图" : "Take screenshot"}
          aria-label={language === "zh" ? "一键截图" : "Take screenshot"}
        >
          {capturingScreenshot ? (
            <LoaderCircle className="spin" size={19} />
          ) : (
            <Camera size={19} />
          )}
        </button>
      )}

      {screenshotNotice && (
        <div className={`player-capture-notice ${screenshotNotice.type}`}>
          {screenshotNotice.message}
        </div>
      )}

      <div className="player-topbar">
        <div className="player-top-labels">
          {planSegments.length > 0 && (
            <span className={segmentMode ? "segment-mode-label active" : "segment-mode-label"}>
              <Scissors size={11} />
              {language === "zh" ? "清单片段" : "List segments"}
            </span>
          )}
          <span className="player-stream-label">
            {qualityLabel(selectedTrack)}
            {selectedTrack.codec ? ` · ${selectedTrack.codec.split(".")[0]}` : ""}
          </span>
        </div>
      </div>

      <div className="player-controls">
        <div className="player-progress-row">
          <span>{formatDuration(timelinePosition, language)}</span>
          <input
            className="player-progress"
            type="range"
            min="0"
            max={effectiveTimelineDuration || 0}
            step="0.1"
            value={Math.min(
              timelinePosition,
              effectiveTimelineDuration || duration || 0,
            )}
            style={{ "--progress": `${progressPercent}%` } as CSSProperties}
            onChange={(event) => seekTimeline(Number(event.target.value))}
            onPointerDown={() => setControlsVisible(true)}
            onPointerUp={showPlayerControls}
            aria-label={language === "zh" ? "播放进度" : "Playback progress"}
          />
          <span>{formatDuration(effectiveTimelineDuration, language)}</span>
        </div>

        <div className="player-control-row">
          <button type="button" onClick={togglePlayback}>
            {playing ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </button>

          <div className="player-volume">
            <button
              type="button"
              onClick={() => setMuted((current) => !current)}
              aria-label={language === "zh" ? "静音" : "Mute"}
            >
              {muted || volume === 0 ? (
                <VolumeX size={19} />
              ) : (
                <Volume2 size={19} />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              style={
                {
                  "--volume": `${(muted ? 0 : volume) * 100}%`,
                } as CSSProperties
              }
              onChange={(event) => {
                const nextVolume = Number(event.target.value);
                setVolume(nextVolume);
                setMuted(false);
                onVolumeChange(nextVolume);
              }}
              aria-label={language === "zh" ? "音量" : "Volume"}
            />
            <span className="player-volume-value">
              {muted ? (language === "zh" ? "静音" : "Muted") : `${Math.round(volume * 100)}%`}
            </span>
          </div>

          <div className="player-spacer" />

          {planSegments.length > 0 && (
            <button
              type="button"
              className={segmentMode ? "player-tool active" : "player-tool"}
              onClick={toggleSegmentMode}
              title={
                language === "zh"
                  ? "按学习清单片段播放"
                  : "Play selected learning segments"
              }
            >
              <Scissors size={18} />
              <span>{language === "zh" ? "片段" : "Segments"}</span>
            </button>
          )}

          <button
            type="button"
            className={
              danmakuEnabled
                ? "player-tool danmaku-tool active"
                : "player-tool danmaku-tool"
            }
            onClick={onToggleDanmaku}
            title={language === "zh" ? "弹幕开关" : "Danmaku toggle"}
          >
            {danmakuEnabled ? (
              <MessageSquareText size={18} />
            ) : (
              <MessageSquareOff size={18} />
            )}
            <span>
              {language === "zh"
                ? danmakuEnabled
                  ? "弹幕开"
                  : "弹幕关"
                : danmakuEnabled
                  ? "Danmaku on"
                  : "Danmaku off"}
            </span>
            <span
              className={
                danmakuEnabled
                  ? "player-toggle-status on"
                  : "player-toggle-status"
              }
            />
          </button>

          {playlistOverlay}

          <div className="quality-control">
            <button
              type="button"
              className="player-tool"
              onClick={() => {
                setRateOpen((current) => !current);
                setQualityOpen(false);
              }}
            >
              <Gauge size={18} />
              <span>{playbackRate}x</span>
              <ChevronUp size={13} />
            </button>
            {rateOpen && (
              <div className="quality-menu rate-menu">
                {[0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((rate) => (
                  <button
                    type="button"
                    key={rate}
                    className={playbackRate === rate ? "active" : ""}
                    onClick={() => chooseRate(rate)}
                  >
                    <span>{rate}x</span>
                    {playbackRate === rate && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="quality-control">
            <button
              type="button"
              className="player-tool"
              onClick={() => {
                setQualityOpen((current) => !current);
                setRateOpen(false);
              }}
            >
              <Settings2 size={18} />
              <span>{qualityLabel(selectedTrack)}</span>
              <ChevronUp size={13} />
            </button>
            {qualityOpen && (
              <div className="quality-menu">
                {playback.videoTracks.map((track) => (
                  <button
                    type="button"
                    key={track.id}
                    className={track.id === selectedTrack.id ? "active" : ""}
                    onClick={() => chooseTrack(track)}
                  >
                    <span>{qualityLabel(track)}</span>
                    {track.id === selectedTrack.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className={miniPlayerActive ? "player-tool active" : "player-tool"}
            onClick={onToggleMiniPlayer}
            title={
              miniPlayerActive
                ? language === "zh"
                  ? "退出迷你播放器"
                  : "Exit mini player"
                : language === "zh"
                  ? "迷你播放器"
                  : "Mini player"
            }
          >
            <Minimize2 size={18} />
          </button>

          <button
            type="button"
            className="player-tool"
            onClick={toggleFullscreen}
            title={language === "zh" ? "全屏" : "Fullscreen"}
          >
            <Maximize size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
