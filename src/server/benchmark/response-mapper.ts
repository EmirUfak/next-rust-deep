import {
  type AddonHealth,
  type BenchmarkResponseBody,
  type BenchmarkRunResult,
  type MatrixResultMode,
  type RustBatchingMode,
  type BenchmarkRequestBody,
} from "@/lib/benchmark-types";

interface BuildBenchmarkResponseOptions {
  requestId: string;
  benchmarkRequest: BenchmarkRequestBody;
  rustBatching: RustBatchingMode;
  matrixResultMode: MatrixResultMode | undefined;
  runs: BenchmarkRunResult[];
  addon: AddonHealth;
}

interface BuiltBenchmarkResponse {
  statusCode: number;
  body: BenchmarkResponseBody;
}

function buildComparison(
  runs: BenchmarkRunResult[],
): BenchmarkResponseBody["comparison"] {
  const jsRun = runs.find((run) => run.implementation === "js" && !run.error);
  const rustRun = runs.find(
    (run) => run.implementation === "rust" && !run.error,
  );

  if (!jsRun || !rustRun) {
    return undefined;
  }

  if (Math.abs(jsRun.durationMs - rustRun.durationMs) <= 0.0001) {
    return { faster: "tie", speedupRatio: null };
  }

  if (rustRun.durationMs < jsRun.durationMs) {
    return {
      faster: "rust",
      speedupRatio: Number((jsRun.durationMs / rustRun.durationMs).toFixed(3)),
    };
  }

  return {
    faster: "js",
    speedupRatio: Number((rustRun.durationMs / jsRun.durationMs).toFixed(3)),
  };
}

export function buildBenchmarkResponse(
  options: BuildBenchmarkResponseOptions,
): BuiltBenchmarkResponse {
  const {
    requestId,
    benchmarkRequest,
    rustBatching,
    matrixResultMode,
    runs,
    addon,
  } = options;

  const comparison = buildComparison(runs);
  const ok = runs.every((run) => !run.error);
  const successfulRunCount = runs.filter((run) => !run.error).length;

  const response: BenchmarkResponseBody = {
    ok,
    requestId,
    algorithm: benchmarkRequest.algorithm,
    iterations: benchmarkRequest.iterations,
    rustBatching,
    resultMode: matrixResultMode,
    runs,
    addon,
    comparison,
  };

  if (!ok) {
    const firstError = runs.find((run) => run.error)?.error;
    response.error = {
      code: "BENCHMARK_PARTIAL_FAILURE",
      message: firstError ?? "Benchmark failed.",
    };
  }

  return {
    statusCode: successfulRunCount > 0 ? 200 : 503,
    body: response,
  };
}
