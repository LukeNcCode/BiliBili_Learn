import type { ImportedLearningList } from "../types";
import { allLessons, normalizeCreatorProject } from "./creator";
import { ensureUniqueCourseIds } from "./persistentData";

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function fileNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.json$/i, "") || "本地学习清单";
}

export function normalizeOfflineLearningList(
  raw: unknown,
  fileName: string,
  importedAt = Date.now(),
): ImportedLearningList {
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray((raw as { courses?: unknown }).courses)
  ) {
    throw new Error("学习清单 JSON 顶层必须包含 courses 数组");
  }

  const project = normalizeCreatorProject(raw);
  if (allLessons(project).length === 0) {
    throw new Error("学习清单中没有可用的 B 站视频");
  }

  const slug = fileNameWithoutExtension(fileName);
  const fingerprint = hashText(JSON.stringify(raw));
  return {
    id: `offline:${slug.toLowerCase()}:${fingerprint}`,
    name: project.name || slug,
    description: project.description,
    goal: project.goal,
    author: project.author,
    createdAt: project.createdAt,
    courses: ensureUniqueCourseIds(project.courses),
    sourceUrl: "",
    manifestUrl: "",
    repository: fileName || "本地学习清单",
    source: "local",
    importedAt,
  };
}
