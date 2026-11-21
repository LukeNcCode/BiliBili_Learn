import {
  env,
  LogLevel,
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";
import type {
  SemanticCandidate,
  SemanticClassification,
} from "../lib/localSemantic";
import {
  chooseSemanticSubject,
  semanticSubjectKeys,
  semanticSubjectPrototypes,
} from "../lib/semanticTaxonomy";
import type { SubjectKey } from "../types";

interface ClassifyMessage {
  requestId: number;
  candidates: SemanticCandidate[];
}

interface WorkerResponse {
  requestId: number;
  ok: boolean;
  classifications?: SemanticClassification[];
  error?: string;
}

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let prototypeVectorsPromise: Promise<Record<SubjectKey, number[]>> | null =
  null;
let taskQueue = Promise.resolve();

const publicRoot =
  self.location.protocol === "http:" || self.location.protocol === "https:"
    ? new URL("/", self.location.href)
    : new URL("../", self.location.href);

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;
env.useWasmCache = false;
env.localModelPath = new URL("models/", publicRoot).href;
const wasmBackend = env.backends.onnx.wasm;
if (!wasmBackend) {
  throw new Error("ONNX WASM backend is unavailable");
}
wasmBackend.wasmPaths = {
  mjs: new URL("runtime/onnx/ort-wasm-simd-threaded.mjs", publicRoot).href,
  wasm: new URL("runtime/onnx/ort-wasm-simd-threaded.wasm", publicRoot).href,
};
wasmBackend.numThreads = 1;
env.logLevel = LogLevel.ERROR;

function getExtractor() {
  extractorPromise ??= pipeline(
    "feature-extraction",
    "bge-small-zh-v1.5",
    {
      device: "wasm",
      dtype: "q8",
    },
  ).catch((reason) => {
    extractorPromise = null;
    throw reason;
  });
  return extractorPromise;
}

function dot(left: number[], right: number[]) {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += left[index] * right[index];
  }
  return total;
}

async function embed(texts: string[]) {
  const extractor = await getExtractor();
  const output = await extractor(texts, {
    pooling: "mean",
    normalize: true,
  });
  return output.tolist() as number[][];
}

function getPrototypeVectors() {
  prototypeVectorsPromise ??= embed(
    semanticSubjectKeys.map((subject) => semanticSubjectPrototypes[subject]),
  ).then((vectors) =>
    Object.fromEntries(
      semanticSubjectKeys.map((subject, index) => [subject, vectors[index]]),
    ) as Record<SubjectKey, number[]>,
  ).catch((reason) => {
    prototypeVectorsPromise = null;
    throw reason;
  });
  return prototypeVectorsPromise;
}

async function classify(
  candidates: SemanticCandidate[],
): Promise<SemanticClassification[]> {
  const prototypes = await getPrototypeVectors();
  const classifications: SemanticClassification[] = [];

  for (let offset = 0; offset < candidates.length; offset += 16) {
    const batch = candidates.slice(offset, offset + 16);
    const vectors = await embed(
      batch.map((candidate) => candidate.text.slice(0, 420)),
    );
    batch.forEach((candidate, index) => {
      const scores = Object.fromEntries(
        semanticSubjectKeys.map((subject) => [
          subject,
          dot(vectors[index], prototypes[subject]),
        ]),
      ) as Record<SubjectKey, number>;
      const decision = chooseSemanticSubject(scores);
      classifications.push({
        bvid: candidate.bvid,
        ...decision,
      });
    });
  }

  return classifications;
}

self.onmessage = (event: MessageEvent<ClassifyMessage>) => {
  taskQueue = taskQueue
    .then(async () => {
      const classifications = await classify(event.data.candidates);
      const response: WorkerResponse = {
        requestId: event.data.requestId,
        ok: true,
        classifications,
      };
      self.postMessage(response);
    })
    .catch((reason) => {
      const response: WorkerResponse = {
        requestId: event.data.requestId,
        ok: false,
        error: reason instanceof Error ? reason.message : String(reason),
      };
      self.postMessage(response);
    });
};
