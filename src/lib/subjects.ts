import type { SubjectKey } from "../types";

export const learningSubjects = [
  "programming",
  "engineering",
  "science",
  "math",
  "medicine",
  "law",
  "politics",
  "humanities",
  "business",
  "language",
  "exam",
  "career",
  "general",
] as const satisfies readonly SubjectKey[];

export function enabledLearningSubjects(
  subjects: SubjectKey[] | undefined,
): SubjectKey[] {
  return subjects && subjects.length > 0
    ? subjects
    : [...learningSubjects];
}

export function isSubjectScopeEnabled(
  subject: SubjectKey,
  topics: SubjectKey[] | undefined,
  enabledSubjects: SubjectKey[],
) {
  if (!enabledSubjects.includes(subject)) return false;
  return !(topics || []).some(
    (topic) => topic !== subject && !enabledSubjects.includes(topic),
  );
}
