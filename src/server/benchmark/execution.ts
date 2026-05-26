import {
  BenchmarkTimeoutError,
  runTimedIterations,
} from "@/lib/benchmark-runner";
import {
  type BenchmarkAlgorithm,
  type BenchmarkImplementation,
  type BenchmarkRequestBody,
  type BenchmarkRunResult,
  type MatrixResultMode,
  type RustBatchingMode,
} from "@/lib/benchmark-types";
import {
  NativeAddonUnavailableError,
} from "@/server/native-addon-bridge";

import type { PreparedInput } from "./types";
import {
  executeJsWorkload,
  executeRustNativeBatchWorkload,
  executeRustSingleWorkload,
  supportsNativeBatch,
} from "./workloads";

interface RunBenchmarkImplementationsOptions {
  benchmarkRequest: BenchmarkRequestBody;
  timeoutMs: number;
  rustBatching: RustBatchingMode;
  matrixResultMode: MatrixResultMode | undefined;
  preparedInput: PreparedInput;
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

  if (!supportsNativeBatch(algorithm, matrixResultMode)) {
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

export async function runBenchmarkImplementations(
  options: RunBenchmarkImplementationsOptions,
): Promise<BenchmarkRunResult[]> {
  const {
    benchmarkRequest,
    timeoutMs,
    rustBatching,
    matrixResultMode,
    preparedInput,
  } = options;

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
        const result = await executeRustNativeBatchWorkload(
          preparedInput,
          benchmarkRequest.iterations,
          matrixResultMode,
        );
        const elapsedMs = performance.now() - startedAt;

        if (elapsedMs > timeoutMs) {
          throw new BenchmarkTimeoutError(timeoutMs, "total");
        }

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
            ? executeJsWorkload(preparedInput, matrixResultMode)
            : executeRustSingleWorkload(preparedInput, matrixResultMode),
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
        {
          iterationTimeoutMs: timeoutMs,
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
        batchMode:
          implementation === "rust" ? (batched ? "native" : "none") : undefined,
        callbackCalls: batched ? 1 : benchmarkRequest.iterations,
        resultMode: matrixResultMode,
        error: extractErrorMessage(error),
      });
    }
  }

  return runs;
}
