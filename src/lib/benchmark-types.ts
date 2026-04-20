export const WORKLOAD_LIMITS = {
  bodyBytes: 8 * 1024,
  iterations: {
    min: 1,
    max: 10,
  },
  timeoutMs: {
    min: 200,
    max: 30_000,
    default: 8_000,
  },
  primeLimit: {
    min: 10,
    max: 10_000_000,
  },
  matrixSize: {
    min: 8,
    max: 240,
  },
  vectorSize: {
    min: 1_000,
    max: 2_000_000,
  },
} as const;

export type BenchmarkAlgorithm =
  | "prime-count"
  | "matrix-multiply"
  | "dot-product";

export type BenchmarkMode = "js" | "rust" | "compare";

export type BenchmarkImplementation = "js" | "rust";

export type MatrixResultMode = "full" | "summary";

export type RustBatchingMode = "none" | "native";

export interface BenchmarkWorkload {
  limit?: number;
  matrixSize?: number;
  vectorSize?: number;
}

export interface BenchmarkRequestBody {
  algorithm: BenchmarkAlgorithm;
  implementation: BenchmarkMode;
  iterations: number;
  timeoutMs?: number;
  resultMode?: MatrixResultMode;
  rustBatching?: RustBatchingMode;
  workload: BenchmarkWorkload;
}

export interface BenchmarkRunResult {
  implementation: BenchmarkImplementation;
  inputSize: number;
  resultSummary: string;
  durationMs: number;
  computeMs?: number | null;
  transferMs?: number | null;
  batchMode?: RustBatchingMode;
  callbackCalls?: number;
  resultMode?: MatrixResultMode;
  error?: string;
}

export interface AddonHealth {
  available: boolean;
  error?: string;
}

export interface BenchmarkResponseBody {
  ok: boolean;
  requestId: string;
  algorithm: BenchmarkAlgorithm;
  iterations: number;
  rustBatching: RustBatchingMode;
  resultMode?: MatrixResultMode;
  runs: BenchmarkRunResult[];
  addon: AddonHealth;
  comparison?: {
    faster: BenchmarkImplementation | "tie";
    speedupRatio: number | null;
  };
  error?: {
    code: string;
    message: string;
  };
}
