import type {
  CreatorProject,
  LearningCourse,
  LearningLesson,
  LearningSegment,
} from "../types";

function newId(prefix: string) {
  const suffix =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function text(value: unknown, fallback = "") {
  return String(value ?? fallback)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localDateTime(value = new Date()) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
    value.getDate(),
  )}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function normalizeCreatedAt(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : localDateTime(parsed);
}

export function normalizeSegments(value: unknown): LearningSegment[] {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item, index) => {
      const segment = item as Partial<LearningSegment>;
      return {
        id: text(segment.id) || newId("segment"),
        start: Math.max(0, numeric(segment.start)),
        end: Math.max(0, numeric(segment.end)),
        title: text(segment.title, `片段 ${index + 1}`),
      };
    })
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start,
    )
    .sort((left, right) => left.start - right.start);
}

export function mergeSegments(
  value: Array<Pick<LearningSegment, "start" | "end" | "title">>,
) {
  const sorted = value
    .map((segment) => ({
      id: newId("segment"),
      start: Math.max(0, numeric(segment.start)),
      end: Math.max(0, numeric(segment.end)),
      title: text(segment.title, "重点片段"),
    }))
    .filter((segment) => segment.end > segment.start)
    .sort((left, right) => left.start - right.start);

  return sorted.reduce<LearningSegment[]>((merged, segment) => {
    const previous = merged.at(-1);
    if (previous && segment.start <= previous.end) {
      previous.end = Math.max(previous.end, segment.end);
      if (segment.title && !previous.title.includes(segment.title)) {
        previous.title = `${previous.title}、${segment.title}`;
      }
      return merged;
    }
    merged.push(segment);
    return merged;
  }, []);
}

export function normalizeCreatorProject(raw: unknown): CreatorProject {
  const payload =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};
  const rawCourses = Array.isArray(payload.courses) ? payload.courses : [];
  const courses: LearningCourse[] = rawCourses
    .map((item, courseIndex) => {
      const course = item as Record<string, unknown>;
      const rawSections = Array.isArray(course.sections)
        ? course.sections
        : [];
      const sections = rawSections
        .map((sectionItem, sectionIndex) => {
          const section = sectionItem as Record<string, unknown>;
          const rawLessons = Array.isArray(section.lessons)
            ? section.lessons
            : [];
          const lessons = rawLessons
            .map((lessonItem, lessonIndex) => {
              const lesson = lessonItem as Record<string, unknown>;
              const bvid = text(lesson.bvid);
              const url = text(lesson.url);
              if (!bvid && !/BV[a-zA-Z0-9]{8,}/i.test(url)) return null;
              const segments = normalizeSegments(lesson.segments);
              const collectionId = text(lesson.collectionId);
              const collectionTitle = text(lesson.collectionTitle);
              const collectionCover = text(lesson.collectionCover);
              return {
                id: text(lesson.id) || newId("lesson"),
                title: text(
                  lesson.title,
                  `视频 ${lessonIndex + 1}`,
                ),
                bvid:
                  bvid ||
                  url.match(/BV[a-zA-Z0-9]{8,}/i)?.[0] ||
                  "",
                cid: numeric(lesson.cid) || null,
                page: numeric(lesson.page) || null,
                url:
                  url ||
                  `https://www.bilibili.com/video/${
                    bvid.match(/BV[a-zA-Z0-9]{8,}/i)?.[0] || bvid
                  }`,
                duration: Math.max(0, numeric(lesson.duration)),
                cover: text(lesson.cover),
                description: text(lesson.description),
                ...(collectionId ? { collectionId } : {}),
                ...(collectionTitle ? { collectionTitle } : {}),
                ...(collectionCover ? { collectionCover } : {}),
                inclusion:
                  lesson.inclusion === "segments" || segments.length > 0
                    ? "segments"
                    : "full",
                segments,
              } satisfies LearningLesson;
            })
            .filter((lesson): lesson is LearningLesson => Boolean(lesson));

          return {
            id: text(section.id) || `${courseIndex + 1}-${sectionIndex + 1}`,
            title: text(section.title, `章节 ${sectionIndex + 1}`),
            lessons,
          };
        })
        .filter((section) => section.lessons.length > 0);

      return {
        id: text(course.id) || `course-${courseIndex + 1}`,
        title: text(course.title, `课程 ${courseIndex + 1}`),
        description: text(course.description),
        cover: text(course.cover),
        author: text(course.author),
        sections,
      } satisfies LearningCourse;
    })
    .filter((course) => course.sections.length > 0);

  return {
    version: 1,
    name: text(payload.name, "新的学习清单"),
    description: text(payload.description),
    goal: text(payload.goal),
    author: text(payload.author),
    createdAt: normalizeCreatedAt(payload.createdAt),
    courses,
  };
}

export function createCreatorProject() {
  return normalizeCreatorProject({});
}

export function stampCreatorProject(
  project: CreatorProject,
  author: string,
  exportedAt = new Date(),
): CreatorProject {
  return {
    ...project,
    author: text(author),
    createdAt: localDateTime(exportedAt),
  };
}

export function clearCreatorProjectContent(
  project: CreatorProject,
): CreatorProject {
  const empty = normalizeCreatorProject({});
  return {
    ...project,
    courses: empty.courses,
  };
}

export function createLesson(input: {
  title: string;
  bvid: string;
  cid?: number | null;
  page?: number | null;
  duration?: number;
  cover?: string;
  description?: string;
  collectionId?: string;
  collectionTitle?: string;
  collectionCover?: string;
  inclusion?: "full" | "segments";
  segments?: Array<Pick<LearningSegment, "start" | "end" | "title">>;
}): LearningLesson {
  const segments =
    input.inclusion === "segments"
      ? mergeSegments(input.segments || [])
      : [];
  const collectionId = text(input.collectionId);
  const collectionTitle = text(input.collectionTitle);
  const collectionCover = text(input.collectionCover);
  return {
    id: newId("lesson"),
    title: text(input.title),
    bvid: input.bvid,
    cid: input.cid || null,
    page: input.page || null,
    url: `https://www.bilibili.com/video/${input.bvid}`,
    duration: Math.max(0, numeric(input.duration)),
    cover: text(input.cover),
    description: text(input.description),
    ...(collectionId ? { collectionId } : {}),
    ...(collectionTitle ? { collectionTitle } : {}),
    ...(collectionCover ? { collectionCover } : {}),
    inclusion: segments.length > 0 ? "segments" : "full",
    segments,
  };
}

export interface LessonCollectionGroup {
  key: string;
  title: string;
  cover: string;
  lessons: LearningLesson[];
}

export function groupLessonsByCollection(
  lessons: LearningLesson[],
): LessonCollectionGroup[] {
  const groups = new Map<string, LessonCollectionGroup>();

  lessons.forEach((lesson) => {
    const titleParts = lesson.title.split(" · ");
    const inferredTitle = titleParts.length > 1 ? titleParts[0].trim() : "";
    const explicitTitle = lesson.collectionTitle?.trim() || "";
    const key = lesson.collectionId
      ? `collection:${lesson.collectionId}`
      : inferredTitle
        ? `title:${inferredTitle}`
        : `video:${lesson.bvid || lesson.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.lessons.push(lesson);
      if (!existing.cover) {
        existing.cover = lesson.collectionCover || lesson.cover;
      }
      return;
    }
    groups.set(key, {
      key,
      title: explicitTitle || inferredTitle || lesson.title,
      cover: lesson.collectionCover || lesson.cover,
      lessons: [lesson],
    });
  });

  return [...groups.values()];
}

export function lessonTitleWithinCollection(
  lesson: LearningLesson,
  collectionTitle: string,
) {
  if (lesson.collectionTitle) {
    const explicitPrefix = `${lesson.collectionTitle} · `;
    if (lesson.title.startsWith(explicitPrefix)) {
      return lesson.title.slice(explicitPrefix.length);
    }
  }
  const inferredPrefix = `${collectionTitle} · `;
  return lesson.title.startsWith(inferredPrefix)
    ? lesson.title.slice(inferredPrefix.length)
    : lesson.title;
}

export function allLessons(project: CreatorProject) {
  return project.courses.flatMap((course) =>
    course.sections.flatMap((section) =>
      section.lessons.map((lesson) => ({ course, section, lesson })),
    ),
  );
}

export function findLessonEntry(
  project: CreatorProject,
  lessonId: string,
) {
  return allLessons(project).find((entry) => entry.lesson.id === lessonId);
}

export function findLessonForPart(
  project: CreatorProject,
  bvid: string,
  cid?: number | null,
) {
  return allLessons(project).find(
    ({ lesson }) =>
      lesson.bvid === bvid && (!cid || !lesson.cid || lesson.cid === cid),
  );
}

export function addLessonToProject(
  project: CreatorProject,
  courseId: string,
  sectionId: string,
  lesson: LearningLesson,
) {
  let added = false;
  const courses = project.courses.map((course) => {
    if (course.id !== courseId) return course;
    return {
      ...course,
      sections: course.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const duplicate = section.lessons.some(
          (item) =>
            item.bvid === lesson.bvid &&
            (item.cid || null) === (lesson.cid || null),
        );
        if (duplicate) return section;
        added = true;
        return { ...section, lessons: [...section.lessons, lesson] };
      }),
    };
  });
  return {
    project: { ...project, courses },
    added,
  };
}

export function updateProjectLesson(
  project: CreatorProject,
  lessonId: string,
  patch: Partial<LearningLesson>,
): CreatorProject {
  return {
    ...project,
    courses: project.courses.map((course) => ({
      ...course,
      sections: course.sections.map((section) => ({
        ...section,
        lessons: section.lessons.map((lesson) =>
          lesson.id === lessonId ? { ...lesson, ...patch } : lesson,
        ),
      })),
    })),
  };
}

export function removeProjectLessons(
  project: CreatorProject,
  lessonIds: Set<string>,
): CreatorProject {
  return {
    ...project,
    courses: project.courses.map((course) => ({
      ...course,
      sections: course.sections.map((section) => ({
        ...section,
        lessons: section.lessons.filter(
          (lesson) => !lessonIds.has(lesson.id),
        ),
      })),
    })),
  };
}

export function removeProjectCourse(
  project: CreatorProject,
  courseId: string,
): CreatorProject {
  return {
    ...project,
    courses: project.courses.filter((course) => course.id !== courseId),
  };
}

export function removeProjectSection(
  project: CreatorProject,
  courseId: string,
  sectionId: string,
): CreatorProject {
  return {
    ...project,
    courses: project.courses.map((course) =>
      course.id === courseId
        ? {
            ...course,
            sections: course.sections.filter(
              (section) => section.id !== sectionId,
            ),
          }
        : course,
    ),
  };
}

export function mergeProjectSegments(
  project: CreatorProject,
  lessonIds: Set<string>,
  segments: Array<Pick<LearningSegment, "start" | "end" | "title">>,
): CreatorProject {
  const merged = mergeSegments(segments);
  return {
    ...project,
    courses: project.courses.map((course) => ({
      ...course,
      sections: course.sections.map((section) => ({
        ...section,
        lessons: section.lessons.map((lesson) =>
          lessonIds.has(lesson.id)
            ? {
                ...lesson,
                inclusion: merged.length > 0 ? "segments" : "full",
                segments: merged.map((segment) => ({
                  ...segment,
                  id: newId("segment"),
                })),
              }
            : lesson,
        ),
      })),
    })),
  };
}

export function markProjectLessonsFull(
  project: CreatorProject,
  lessonIds: Set<string>,
) {
  return {
    ...project,
    courses: project.courses.map((course) => ({
      ...course,
      sections: course.sections.map((section) => ({
        ...section,
        lessons: section.lessons.map((lesson) =>
          lessonIds.has(lesson.id)
            ? { ...lesson, inclusion: "full" as const, segments: [] }
            : lesson,
        ),
      })),
    })),
  };
}
