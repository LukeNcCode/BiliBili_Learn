import type {
  ImportedLearningList,
  LearningLesson,
} from "../types";

export function lessonPlannedDuration(lesson: LearningLesson) {
  if (lesson.inclusion === "segments" && lesson.segments.length > 0) {
    return lesson.segments.reduce(
      (total, segment) => total + Math.max(0, segment.end - segment.start),
      0,
    );
  }
  return Math.max(0, lesson.duration);
}

export function sumLessonDurations(lessons: LearningLesson[]) {
  return lessons.reduce(
    (total, lesson) => total + lessonPlannedDuration(lesson),
    0,
  );
}

export function countLearningListLessons(list: ImportedLearningList) {
  return list.courses.reduce(
    (total, course) =>
      total +
      course.sections.reduce(
        (sectionTotal, section) =>
          sectionTotal + section.lessons.length,
        0,
      ),
    0,
  );
}

export function learningListDuration(list: ImportedLearningList) {
  return list.courses.reduce(
    (total, course) =>
      total +
      course.sections.reduce(
        (sectionTotal, section) =>
          sectionTotal + sumLessonDurations(section.lessons),
        0,
      ),
    0,
  );
}
