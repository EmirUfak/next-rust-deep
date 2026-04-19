import { NextResponse } from "next/server";

import {
  countPrimesJs,
  createMatrixInput,
  createVectorInput,
  dotProductJs,
  multiplyMatricesJs,
  summarizeResult,
} from "@/lib/benchmark-js";
import {
  BenchmarkTimeoutError,
  runTimedIterations,
} from "@/lib/benchmark-runner";
import {
  type BenchmarkImplementation,
  type BenchmarkRequestBody,
  type BenchmarkResponseBody,
  type BenchmarkRunResult,
  WORKLOAD_LIMITS,
} from "@/lib/benchmark-types";
import { parseBenchmarkRequest } from "@/lib/validation";
import {
  getNativeAddonHealth,
  NativeAddonUnavailableError,
  runRustDotProduct,
  runRustMatrixMultiply,
  runRustPrimeCount,
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
      left: number[];
      right: number[];
    }
  | {
      algorithm: "dot-product";
      inputSize: number;
      left: number[];
      right: number[];
    };

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

function executeJs(prepared: PreparedInput): number | number[] {
  switch (prepared.algorithm) {
    case "prime-count":
      return countPrimesJs(prepared.limit);

    case "matrix-multiply":
      return multiplyMatricesJs(prepared.left, prepared.right, prepared.size);

    case "dot-product":
      return dotProductJs(prepared.left, prepared.right);
  }
}

async function executeRust(
  prepared: PreparedInput,
): Promise<number | number[]> {
  switch (prepared.algorithm) {
    case "prime-count":
      return runRustPrimeCount(prepared.limit);

    case "matrix-multiply":
      return runRustMatrixMultiply(
        prepared.left,
        prepared.right,
        prepared.size,
      );

    case "dot-product":
      return runRustDotProduct(prepared.left, prepared.right);
  }
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
  const preparedInput = prepareInput(benchmarkRequest);
  const addon = await getNativeAddonHealth();

  const implementations: BenchmarkImplementation[] =
    benchmarkRequest.implementation === "compare"
      ? ["js", "rust"]
      : [benchmarkRequest.implementation];

  const runs: BenchmarkRunResult[] = [];

  for (const implementation of implementations) {
    try {
      const timed = await runTimedIterations(
        () =>
          implementation === "js"
            ? executeJs(preparedInput)
            : executeRust(preparedInput),
        benchmarkRequest.iterations,
        timeoutMs,
      );

      runs.push({
        implementation,
        inputSize: preparedInput.inputSize,
        resultSummary: summarizeResult(timed.result),
        durationMs: timed.durationMs,
      });
    } catch (error) {
      runs.push({
        implementation,
        inputSize: preparedInput.inputSize,
        resultSummary: "n/a",
        durationMs: 0,
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
