import type {
  ClassifiedVideo,
  ImportedLearningList,
  LearningCourse,
  PlaybackProgress,
  StudyHistory,
} from "../types";
import { normalizeCreatorProject } from "./creator";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, maxLength = 500) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeFeedbackMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 5000)
      .map(([key, feedback]) => [text(key, 180), finiteNumber(feedback)])
      .filter(([key]) => Boolean(key)),
  );
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 220)).filter(Boolean))].slice(
    0,
    5000,
  );
}

export function normalizeNumberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 5000)
      .map(([key, item]) => [
        text(key, 220),
        Math.max(0, finiteNumber(item)),
      ])
      .filter(([key]) => Boolean(key)),
  );
}

export function normalizeProgressMap(
  value: unknown,
): Record<string, PlaybackProgress> {
  if (!isRecord(value)) return {};
  const entries: [string, PlaybackProgress][] = [];
  for (const [key, item] of Object.entries(value).slice(0, 5000)) {
    if (!isRecord(item)) continue;
    const duration = Math.max(0, finiteNumber(item.duration));
    const currentTime = Math.max(
      0,
      Math.min(duration || Number.MAX_SAFE_INTEGER, finiteNumber(item.currentTime)),
    );
    const bvid = text(item.bvid, 40);
    const cid = finiteNumber(item.cid);
    if (!bvid || !cid) continue;
    entries.push([
      text(key, 220),
      {
        key: text(item.key || key, 220),
        bvid,
        cid,
        currentTime,
        duration,
        completed: Boolean(item.completed),
        updatedAt: Math.max(0, finiteNumber(item.updatedAt)),
      },
    ]);
  }
  return Object.fromEntries(entries);
}

export function normalizeHistory(value: unknown): StudyHistory[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 100)
    .map((item) => {
      if (!isRecord(item)) return null;
      const bvid = text(item.bvid, 40);
      const title = text(item.title, 300);
      if (!bvid || !title) return null;
      return {
        bvid,
        title,
        cover: text(item.cover, 1000),
        author: text(item.author, 200),
        subject: text(item.subject, 50) as StudyHistory["subject"],
        watchedAt: Math.max(0, finiteNumber(item.watchedAt)),
      };
    })
    .filter((item): item is StudyHistory => Boolean(item));
}

export function normalizeSavedSnapshots(
  value: unknown,
): Record<string, ClassifiedVideo> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 3000)
      .filter(
        ([key, item]) =>
          Boolean(key) &&
          isRecord(item) &&
          typeof item.bvid === "string" &&
          typeof item.title === "string",
      ),
  ) as Record<string, ClassifiedVideo>;
}

export function ensureUniqueCourseIds(courses: LearningCourse[]) {
  const courseIds = new Set<string>();
  return courses.slice(0, 200).map((course, courseIndex) => {
    let courseId = course.id || `course-${courseIndex + 1}`;
    if (courseIds.has(courseId)) courseId = `course-${courseIndex + 1}`;
    courseIds.add(courseId);

    const sectionIds = new Set<string>();
    const sections = course.sections.slice(0, 200).map((section, sectionIndex) => {
      let sectionId =
        section.id || `${courseId}-section-${sectionIndex + 1}`;
      if (sectionIds.has(sectionId)) {
        sectionId = `${courseId}-section-${sectionIndex + 1}`;
      }
      sectionIds.add(sectionId);

      const lessonIds = new Set<string>();
      const lessons = section.lessons.slice(0, 1000).map((lesson, lessonIndex) => {
        let lessonId =
          lesson.id || `${sectionId}-lesson-${lessonIndex + 1}`;
        if (lessonIds.has(lessonId)) {
          lessonId = `${sectionId}-lesson-${lessonIndex + 1}`;
        }
        lessonIds.add(lessonId);
        return { ...lesson, id: lessonId };
      });
      return { ...section, id: sectionId, lessons };
    });
    return { ...course, id: courseId, sections };
  });
}

export function normalizeLearningLists(value: unknown): ImportedLearningList[] {
  if (!Array.isArray(value)) return [];
  const listIds = new Set<string>();
  return value
    .slice(0, 100)
    .map((item, index): ImportedLearningList | null => {
      if (!isRecord(item)) return null;
      const project = normalizeCreatorProject({
        name: item.name,
        description: item.description,
        goal: item.goal,
        author: item.author,
        createdAt: item.createdAt,
        courses: Array.isArray(item.courses) ? item.courses.slice(0, 200) : [],
      });
      if (project.courses.length === 0) return null;
      let id = text(item.id, 240) || `persisted-list-${index + 1}`;
      if (listIds.has(id)) id = `persisted-list-${index + 1}`;
      listIds.add(id);
      return {
        id,
        name: project.name,
        description: project.description,
        goal: project.goal,
        author: project.author,
        createdAt: project.createdAt,
        courses: ensureUniqueCourseIds(project.courses),
        sourceUrl: text(item.sourceUrl, 1000),
        manifestUrl: text(item.manifestUrl, 1000),
        repository: text(item.repository, 300),
        source:
          item.source === "github" || item.source === "local"
            ? item.source
            : undefined,
        importedAt: Math.max(0, finiteNumber(item.importedAt)),
      };
    })
    .filter((item): item is ImportedLearningList => item !== null);
}

export function normalizePersistentValue(key: string, value: unknown) {
  switch (key) {
    case "feedback":
      return normalizeFeedbackMap(value);
    case "saved":
      return normalizeStringList(value);
    case "saved-snapshots":
      return normalizeSavedSnapshots(value);
    case "history":
      return normalizeHistory(value);
    case "progress":
      return normalizeProgressMap(value);
    case "learning-lists":
      return normalizeLearningLists(value);
    case "watch-time":
      return normalizeNumberMap(value);
    default:
      return typeof value === "string" ? value.slice(0, 5 * 1024 * 1024) : null;
  }
}
