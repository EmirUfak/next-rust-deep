import {
  type BenchmarkRequestBody,
  type MatrixResultMode,
  type RustBatchingMode,
} from "@/lib/benchmark-types";

export type PreparedInput =
  | {
      algorithm: "prime-count";
      inputSize: number;
      limit: number;
    }
  | {
      algorithm: "matrix-multiply";
      inputSize: number;
      size: number;
      left: Float64Array;
      right: Float64Array;
    }
  | {
      algorithm: "dot-product";
      inputSize: number;
      left: Float64Array;
      right: Float64Array;
    };

export interface ExecutionResult {
  resultSummary: string;
  computeMs?: number;
}

export interface ParsedBenchmarkRouteRequest {
  benchmarkRequest: BenchmarkRequestBody;
  timeoutMs: number;
  rustBatching: RustBatchingMode;
  matrixResultMode: MatrixResultMode | undefined;
  preparedInput: PreparedInput;
}
