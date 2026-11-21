import type {
  ImportedLearningList,
  LearningCourse,
  LearningLesson,
  LearningSection,
} from "../types";

export interface LearningListSearchResult {
  list: ImportedLearningList;
  courses: {
    course: LearningCourse;
    sections: {
      section: LearningSection;
      lessons: LearningLesson[];
    }[];
  }[];
}

function normalize(value: unknown) {
  return String(value ?? "").toLocaleLowerCase();
}

function matches(query: string, ...values: unknown[]) {
  return values.some((value) => normalize(value).includes(query));
}

export function searchLearningLists(
  lists: ImportedLearningList[],
  rawQuery: string,
): LearningListSearchResult[] {
  const query = normalize(rawQuery).trim();
  if (!query) {
    return lists.map((list) => ({
      list,
      courses: list.courses.map((course) => ({
        course,
        sections: course.sections.map((section) => ({
          section,
          lessons: section.lessons,
        })),
      })),
    }));
  }

  return lists.flatMap((list) => {
    const listMatches = matches(
      query,
      list.name,
      list.description,
      list.goal,
      list.author,
      list.createdAt,
      list.repository,
    );
    const courses = list.courses.flatMap((course) => {
      const courseMatches =
        listMatches ||
        matches(
          query,
          course.title,
          course.description,
          course.author,
        );
      const sections = course.sections.flatMap((section) => {
        const sectionMatches =
          courseMatches || matches(query, section.title);
        const lessons = section.lessons.filter(
          (lesson) =>
            sectionMatches ||
            matches(
              query,
              lesson.title,
              lesson.bvid,
              lesson.description,
              ...lesson.segments.map((segment) => segment.title),
            ),
        );
        return sectionMatches || lessons.length > 0
          ? [{ section, lessons }]
          : [];
      });
      return courseMatches || sections.length > 0
        ? [{ course, sections }]
        : [];
    });

    return listMatches || courses.length > 0 ? [{ list, courses }] : [];
  });
}
