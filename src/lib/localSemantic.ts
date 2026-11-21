import type { SubjectKey } from "../types";

export type SemanticStatus = "idle" | "loading" | "ready" | "error";

export interface SemanticCandidate {
  bvid: string;
  text: string;
}

export interface SemanticClassification {
  bvid: string;
  subject: SubjectKey;
  score: number;
  margin: number;
}

interface WorkerResult {
  requestId: number;
  ok: boolean;
  classifications?: SemanticClassification[];
  error?: string;
}

interface PendingRequest {
  resolve: (results: SemanticClassification[]) => void;
  reject: (reason: Error) => void;
  timeout: number;
  worker: Worker;
}

let semanticWorker: Worker | null = null;
let requestCounter = 0;
const pendingRequests = new Map<number, PendingRequest>();

function rejectAll(reason: Error) {
  pendingRequests.forEach((pending) => {
    window.clearTimeout(pending.timeout);
    pending.reject(reason);
  });
  pendingRequests.clear();
}

function rejectWorkerRequests(worker: Worker, reason: Error) {
  pendingRequests.forEach((pending, requestId) => {
    if (pending.worker !== worker) return;
    window.clearTimeout(pending.timeout);
    pending.reject(reason);
    pendingRequests.delete(requestId);
  });
}

function getSemanticWorker() {
  if (semanticWorker) return semanticWorker;
  semanticWorker = new Worker(
    new URL("../workers/semanticClassifier.worker.ts", import.meta.url),
    { type: "module" },
  );
  semanticWorker.onmessage = (event: MessageEvent<WorkerResult>) => {
    const pending = pendingRequests.get(event.data.requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeout);
    pendingRequests.delete(event.data.requestId);
    if (event.data.ok && event.data.classifications) {
      pending.resolve(event.data.classifications);
    } else {
      pending.reject(
        new Error(event.data.error || "Local semantic classification failed"),
      );
    }
  };
  semanticWorker.onerror = (event) => {
    rejectAll(new Error(event.message || "Local semantic worker failed"));
    semanticWorker?.terminate();
    semanticWorker = null;
  };
  return semanticWorker;
}

export function classifyVideosLocally(
  candidates: SemanticCandidate[],
): Promise<SemanticClassification[]> {
  if (candidates.length === 0) return Promise.resolve([]);
  const worker = getSemanticWorker();
  const requestId = ++requestCounter;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      rejectWorkerRequests(
        worker,
        new Error("Local semantic model timed out"),
      );
      worker.terminate();
      if (semanticWorker === worker) semanticWorker = null;
    }, 45000);
    pendingRequests.set(requestId, { resolve, reject, timeout, worker });
    worker.postMessage({ requestId, candidates });
  });
}

export function warmupLocalSemanticModel() {
  return classifyVideosLocally([
    {
      bvid: "__warmup__",
      text: "计算机编程课程与工程控制理论学习",
    },
  ]);
}
