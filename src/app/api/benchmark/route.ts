import { NextResponse } from "next/server";

import {
  countPrimesJs,
  createMatrixInput,
  createVectorInput,
  dotProductJs,
  multiplyMatricesJs,
  multiplyMatricesSummaryJs,
  summarizeMatrixSummary,
  summarizeResult,
} from "@/lib/benchmark-js";
import {
  BenchmarkTimeoutError,
  runTimedIterations,
} from "@/lib/benchmark-runner";
import {
  type BenchmarkAlgorithm,
  type BenchmarkImplementation,
  type BenchmarkRequestBody,
  type BenchmarkResponseBody,
  type BenchmarkRunResult,
  type MatrixResultMode,
  type RustBatchingMode,
  WORKLOAD_LIMITS,
} from "@/lib/benchmark-types";
import { parseBenchmarkRequest } from "@/lib/validation";
import {
  getNativeAddonHealth,
  NativeAddonUnavailableError,
  runRustDotProductBatchTimed,
  runRustDotProductTimed,
  runRustMatrixMultiply,
  runRustMatrixSummaryBatchTimed,
  runRustMatrixSummaryTimed,
  runRustPrimeCountBatchTimed,
  runRustPrimeCountTimed,
} from "@/server/native-addon-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PreparedInput =
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

interface ExecutionResult {
  resultSummary: string;
  computeMs?: number;
}

function createRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function prepareInput(request: BenchmarkRequestBody): PreparedInput {
  switch (request.algorithm) {
    case "prime-count": {
      const limit = request.workload.limit as number;
      return {
        algorithm: "prime-count",
        inputSize: limit,
        limit,
      };
    }

    case "matrix-multiply": {
      const size = request.workload.matrixSize as number;
      const { left, right } = createMatrixInput(size);
      return {
        algorithm: "matrix-multiply",
        inputSize: size,
        size,
        left,
        right,
      };
    }

    case "dot-product": {
      const size = request.workload.vectorSize as number;
      const { left, right } = createVectorInput(size);
      return {
        algorithm: "dot-product",
        inputSize: size,
        left,
        right,
      };
    }
  }
}

function resolveMatrixResultMode(
  request: BenchmarkRequestBody,
): MatrixResultMode | undefined {
  if (request.algorithm !== "matrix-multiply") {
    return undefined;
  }

  return request.resultMode ?? "summary";
}

function executeJs(
  prepared: PreparedInput,
  matrixResultMode: MatrixResultMode | undefined,
): ExecutionResult {
  switch (prepared.algorithm) {
    case "prime-count": {
      const value = countPrimesJs(prepared.limit);
      return {
        resultSummary: summarizeResult(value),
      };
    }

    case "matrix-multiply": {
      if (matrixResultMode === "summary") {
        const summary = multiplyMatricesSummaryJs(
          prepared.left,
          prepared.right,
          prepared.size,
        );

        return {
          resultSummary: summarizeMatrixSummary(summary),
        };
      }

      const value = multiplyMatricesJs(prepared.left, prepared.right, prepared.size);
      return {
        resultSummary: summarizeResult(value),
      };
    }

    case "dot-product": {
      const value = dotProductJs(prepared.left, prepared.right);
      return {
        resultSummary: summarizeResult(value),
      };
    }
  }
}

async function executeRustSingle(
  prepared: PreparedInput,
  matrixResultMode: MatrixResultMode | undefined,
): Promise<ExecutionResult> {
  switch (prepared.algorithm) {
    case "prime-count": {
      const timed = await runRustPrimeCountTimed(prepared.limit);
      return {
        resultSummary: summarizeResult(timed.value),
        computeMs: timed.computeMs,
      };
    }

    case "matrix-multiply": {
      if (matrixResultMode === "summary") {
        const timed = await runRustMatrixSummaryTimed(
          prepared.left,
          prepared.right,
          prepared.size,
        );

        return {
          resultSummary: summarizeMatrixSummary({
            length: timed.length,
            first: timed.first,
            checksum: timed.checksum,
          }),
          computeMs: timed.computeMs,
        };
      }

      const value = await runRustMatrixMultiply(
        prepared.left,
        prepared.right,
        prepared.size,
      );
      return {
        resultSummary: summarizeResult(value),
      };
    }

    case "dot-product": {
      const timed = await runRustDotProductTimed(prepared.left, prepared.right);
      return {
        resultSummary: summarizeResult(timed.value),
        computeMs: timed.computeMs,
      };
    }
  }
}

async function executeRustNativeBatch(
  prepared: PreparedInput,
  iterations: number,
  matrixResultMode: MatrixResultMode | undefined,
): Promise<ExecutionResult> {
  switch (prepared.algorithm) {
    case "prime-count": {
      const timed = await runRustPrimeCountBatchTimed(prepared.limit, iterations);
      return {
        resultSummary: summarizeResult(timed.value),
        computeMs: timed.computeMs,
      };
    }

    case "matrix-multiply": {
      if (matrixResultMode !== "summary") {
        throw new NativeAddonUnavailableError(
          "Native batching is only supported for matrix summary mode.",
        );
      }

      const timed = await runRustMatrixSummaryBatchTimed(
        prepared.left,
        prepared.right,
        prepared.size,
        iterations,
      );

      return {
        resultSummary: summarizeMatrixSummary({
          length: timed.length,
          first: timed.first,
          checksum: timed.checksum,
        }),
        computeMs: timed.computeMs,
      };
    }

    case "dot-product": {
      const timed = await runRustDotProductBatchTimed(
        prepared.left,
        prepared.right,
        iterations,
      );
      return {
        resultSummary: summarizeResult(timed.value),
        computeMs: timed.computeMs,
      };
    }
  }
}

function shouldUseNativeBatch(
  implementation: BenchmarkImplementation,
  algorithm: BenchmarkAlgorithm,
  rustBatching: RustBatchingMode,
  iterations: number,
  matrixResultMode: MatrixResultMode | undefined,
): boolean {
  if (implementation !== "rust") {
    return false;
  }

  if (rustBatching !== "native") {
    return false;
  }

  if (iterations <= 1) {
    return false;
  }

  if (algorithm === "matrix-multiply" && matrixResultMode !== "summary") {
    return false;
  }

  return true;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof NativeAddonUnavailableError) {
    return error.message;
  }

  if (error instanceof BenchmarkTimeoutError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected benchmark failure.";
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

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = createRequestId();

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: {
          code: "INVALID_BODY",
          message: "Request body could not be read.",
        },
      },
      { status: 400 },
    );
  }

  if (rawBody.length > WORKLOAD_LIMITS.bodyBytes) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: {
          code: "REQUEST_TOO_LARGE",
          message: `Request body exceeds ${WORKLOAD_LIMITS.bodyBytes} bytes limit.`,
        },
      },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  const parsed = parseBenchmarkRequest(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: {
          code: "VALIDATION_FAILED",
          message:
            firstIssue?.message ?? "Benchmark request validation failed.",
        },
      },
      { status: 400 },
    );
  }

  const benchmarkRequest = parsed.data;
  const timeoutMs =
    benchmarkRequest.timeoutMs ?? WORKLOAD_LIMITS.timeoutMs.default;
  const rustBatching = benchmarkRequest.rustBatching ?? "native";
  const matrixResultMode = resolveMatrixResultMode(benchmarkRequest);

  const preparedInput = prepareInput(benchmarkRequest);
  const addon = await getNativeAddonHealth();

  const implementations: BenchmarkImplementation[] =
    benchmarkRequest.implementation === "compare"
      ? ["js", "rust"]
      : [benchmarkRequest.implementation];

  const runs: BenchmarkRunResult[] = [];

  for (const implementation of implementations) {
    const batched = shouldUseNativeBatch(
      implementation,
      benchmarkRequest.algorithm,
      rustBatching,
      benchmarkRequest.iterations,
      matrixResultMode,
    );

    try {
      if (batched) {
        const startedAt = performance.now();
        const result = await executeRustNativeBatch(
          preparedInput,
          benchmarkRequest.iterations,
          matrixResultMode,
        );
        const elapsedMs = performance.now() - startedAt;

        const durationMs = Number(
          (elapsedMs / benchmarkRequest.iterations).toFixed(3),
        );
        const computeMs =
          typeof result.computeMs === "number"
            ? Number(result.computeMs.toFixed(3))
            : null;
        const transferMs =
          computeMs === null
            ? null
            : Number(Math.max(durationMs - computeMs, 0).toFixed(3));

        runs.push({
          implementation,
          inputSize: preparedInput.inputSize,
          resultSummary: result.resultSummary,
          durationMs,
          computeMs,
          transferMs,
          batchMode: "native",
          callbackCalls: 1,
          resultMode: matrixResultMode,
        });
        continue;
      }

      const timed = await runTimedIterations(
        () =>
          implementation === "js"
            ? executeJs(preparedInput, matrixResultMode)
            : executeRustSingle(preparedInput, matrixResultMode),
        benchmarkRequest.iterations,
        timeoutMs,
        (result, elapsedMs) => {
          if (implementation === "js") {
            return {
              computeMs: elapsedMs,
              transferMs: 0,
            };
          }

          if (typeof result.computeMs === "number") {
            return {
              computeMs: result.computeMs,
              transferMs: Math.max(elapsedMs - result.computeMs, 0),
            };
          }

          return {};
        },
      );

      runs.push({
        implementation,
        inputSize: preparedInput.inputSize,
        resultSummary: timed.result.resultSummary,
        durationMs: timed.durationMs,
        computeMs: timed.computeMs,
        transferMs: timed.transferMs,
        batchMode: implementation === "rust" ? "none" : undefined,
        callbackCalls: benchmarkRequest.iterations,
        resultMode: matrixResultMode,
      });
    } catch (error) {
      runs.push({
        implementation,
        inputSize: preparedInput.inputSize,
        resultSummary: "n/a",
        durationMs: 0,
        computeMs: null,
        transferMs: null,
        batchMode: implementation === "rust" ? (batched ? "native" : "none") : undefined,
        callbackCalls: batched ? 1 : benchmarkRequest.iterations,
        resultMode: matrixResultMode,
        error: extractErrorMessage(error),
      });
    }
  }

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

  const statusCode = successfulRunCount > 0 ? 200 : 503;
  return NextResponse.json(response, { status: statusCode });
}
