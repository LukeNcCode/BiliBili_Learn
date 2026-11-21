import type {
  ImportedLearningList,
  VideoCandidate,
} from "../types";

export interface LearningAffinityMatch {
  score: number;
  exactVideo: boolean;
  listName: string;
  courseTitle: string;
  sharedTerms: string[];
}

export interface LearningAffinityIndex {
  size: number;
  match: (video: VideoCandidate) => LearningAffinityMatch | null;
}

interface AnchorDocument {
  listName: string;
  courseTitle: string;
  counts: Map<string, number>;
  vector: Map<string, number>;
  bvids: Set<string>;
}

const genericTokens = new Set([
  "课程",
  "教程",
  "学习",
  "入门",
  "基础",
  "基础课",
  "公开课",
  "系统课",
  "精品课",
  "系列课",
  "知识",
  "讲解",
  "教学",
  "视频",
  "合集",
  "全集",
  "完整版",
  "老师",
  "大学",
  "第一",
  "第二",
  "第三",
  "第四",
  "第五",
  "零基",
  "course",
  "courses",
  "class",
  "classes",
  "lesson",
  "lessons",
  "lecture",
  "tutorial",
  "learning",
  "learn",
  "study",
  "introduction",
  "intro",
  "basic",
  "full",
  "complete",
]);

function normalizedText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}+#.]+/gu, " ");
}

function addToken(tokens: string[], value: string) {
  const token = value.trim();
  if (token.length < 2 || genericTokens.has(token)) return;
  tokens.push(token);
}

export function learningTextTokens(value: unknown) {
  const text = normalizedText(value);
  const tokens: string[] = [];

  text.match(/[\p{Script=Han}]+/gu)?.forEach((sequence) => {
    if (sequence.length <= 3) addToken(tokens, sequence);
    if (sequence.length <= 8) addToken(tokens, sequence);
    for (let size = 2; size <= Math.min(3, sequence.length); size += 1) {
      for (let index = 0; index <= sequence.length - size; index += 1) {
        addToken(tokens, sequence.slice(index, index + size));
      }
    }
  });

  text.match(/[a-z0-9][a-z0-9+#.-]*/g)?.forEach((word) => {
    addToken(tokens, word.replace(/[.]+$/g, ""));
  });

  return tokens;
}

function termCounts(tokens: string[]) {
  const counts = new Map<string, number>();
  tokens.forEach((token) => {
    counts.set(token, (counts.get(token) || 0) + 1);
  });
  return counts;
}

function weightedCount(count: number) {
  return 1 + Math.log(Math.max(1, count));
}

function cosineSimilarity(
  candidate: Map<string, number>,
  document: Map<string, number>,
) {
  let dot = 0;
  let candidateMagnitude = 0;
  let documentMagnitude = 0;

  candidate.forEach((weight, term) => {
    candidateMagnitude += weight * weight;
    dot += weight * (document.get(term) || 0);
  });
  document.forEach((weight) => {
    documentMagnitude += weight * weight;
  });

  if (candidateMagnitude === 0 || documentMagnitude === 0) return 0;
  return dot / Math.sqrt(candidateMagnitude * documentMagnitude);
}

function candidateText(video: VideoCandidate) {
  return [
    video.title,
    video.title,
    video.description,
    video.category,
    video.author,
    video.recommendReason,
    ...video.tags,
  ].join(" ");
}

function courseText(list: ImportedLearningList, courseIndex: number) {
  const course = list.courses[courseIndex];
  const lessonText = course.sections.flatMap((section) => [
    section.title,
    ...section.lessons.flatMap((lesson) => [
      lesson.title,
      lesson.description,
      ...lesson.segments.map((segment) => segment.title),
    ]),
  ]);
  return [
    list.name,
    list.description,
    list.goal,
    course.title,
    course.title,
    course.description,
    course.author,
    ...lessonText,
  ].join(" ");
}

export function createLearningAffinityIndex(
  lists: ImportedLearningList[],
): LearningAffinityIndex {
  const documents: AnchorDocument[] = [];
  const documentsByBvid = new Map<string, AnchorDocument>();

  lists.forEach((list) => {
    list.courses.forEach((course, courseIndex) => {
      const counts = termCounts(learningTextTokens(courseText(list, courseIndex)));
      if (counts.size === 0) return;
      const bvids = new Set(
        course.sections
          .flatMap((section) => section.lessons)
          .map((lesson) => lesson.bvid.trim().toLocaleUpperCase())
          .filter(Boolean),
      );
      const document: AnchorDocument = {
        listName: list.name,
        courseTitle: course.title,
        counts,
        vector: new Map(),
        bvids,
      };
      documents.push(document);
      bvids.forEach((bvid) => documentsByBvid.set(bvid, document));
    });
  });

  const documentFrequency = new Map<string, number>();
  documents.forEach((document) => {
    document.counts.forEach((_count, term) => {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    });
  });

  const inverseDocumentFrequency = (term: string) =>
    Math.log(
      (documents.length + 1) /
        ((documentFrequency.get(term) || 0) + 1),
    ) + 1;

  documents.forEach((document) => {
    document.counts.forEach((count, term) => {
      document.vector.set(
        term,
        weightedCount(count) * inverseDocumentFrequency(term),
      );
    });
  });

  return {
    size: documents.length,
    match(video) {
      if (documents.length === 0) return null;
      const exactDocument = documentsByBvid.get(
        video.bvid.trim().toLocaleUpperCase(),
      );
      if (exactDocument) {
        return {
          score: 1,
          exactVideo: true,
          listName: exactDocument.listName,
          courseTitle: exactDocument.courseTitle,
          sharedTerms: [],
        };
      }

      const candidateCounts = termCounts(
        learningTextTokens(candidateText(video)),
      );
      const candidateVector = new Map<string, number>();
      candidateCounts.forEach((count, term) => {
        if (!documentFrequency.has(term)) return;
        candidateVector.set(
          term,
          weightedCount(count) * inverseDocumentFrequency(term),
        );
      });
      if (candidateVector.size === 0) return null;

      let best: {
        document: AnchorDocument;
        score: number;
      } | null = null;
      for (const document of documents) {
        const score = cosineSimilarity(candidateVector, document.vector);
        if (!best || score > best.score) best = { document, score };
      }
      const matched = best;
      if (!matched || matched.score < 0.055) return null;

      const sharedTerms = [...candidateVector.keys()]
        .filter((term) => matched.document.vector.has(term))
        .sort(
          (left, right) =>
            inverseDocumentFrequency(right) -
            inverseDocumentFrequency(left),
        )
        .slice(0, 4);
      return {
        score: matched.score,
        exactVideo: false,
        listName: matched.document.listName,
        courseTitle: matched.document.courseTitle,
        sharedTerms,
      };
    },
  };
}
