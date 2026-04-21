import {
  countPrimesJs,
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
  type BenchmarkRunResult,
  type MatrixResultMode,
  type RustBatchingMode,
} from "@/lib/benchmark-types";
import {
  NativeAddonUnavailableError,
  runRustDotProductBatchTimed,
  runRustDotProductTimed,
  runRustMatrixMultiply,
  runRustMatrixSummaryBatchTimed,
  runRustMatrixSummaryTimed,
  runRustPrimeCountBatchTimed,
  runRustPrimeCountTimed,
} from "@/server/native-addon-bridge";

import type { ExecutionResult, PreparedInput } from "./types";

interface RunBenchmarkImplementationsOptions {
  benchmarkRequest: BenchmarkRequestBody;
  timeoutMs: number;
  rustBatching: RustBatchingMode;
  matrixResultMode: MatrixResultMode | undefined;
  preparedInput: PreparedInput;
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
        const result = await executeRustNativeBatch(
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
