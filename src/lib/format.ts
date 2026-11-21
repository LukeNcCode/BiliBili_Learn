import type { Language } from "../types";
import { translate } from "../i18n";

export function formatDuration(seconds: number, language: Language) {
  if (!seconds || seconds < 0) return "00:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
}

export function formatCompactNumber(value: number, language: Language) {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(value >= 1_000_000_000 ? 0 : 1)}亿`;
  }
  if (value >= 10_000) {
    const suffix = language === "zh" ? "万" : "K";
    return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}${suffix}`;
  }
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatRelativeDate(timestamp: number, language: Language) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return language === "zh" ? "今天" : "Today";
  if (days === 1) return language === "zh" ? "昨天" : "Yesterday";
  if (days < 30) {
    return language === "zh" ? `${days} 天前` : `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  return language === "zh" ? `${months} 个月前` : `${months}mo ago`;
}

export function formatCueTime(seconds: number) {
  return formatDuration(seconds, "zh").replace(/^00:/, "");
}

export function learningTimeLabel(seconds: number, language: Language) {
  if (seconds < 60) return `${seconds}${translate(language, "secondShort")}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}${translate(language, "minuteShort")}`;
  return `${(minutes / 60).toFixed(1)}${translate(language, "hours")}`;
}
