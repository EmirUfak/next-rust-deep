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
  type BenchmarkAlgorithm,
  type BenchmarkRequestBody,
  type MatrixResultMode,
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

interface BenchmarkWorkloadModule<TPrepared extends PreparedInput> {
  prepare: (request: BenchmarkRequestBody) => TPrepared;
  resolveMatrixResultMode?: (request: BenchmarkRequestBody) => MatrixResultMode;
  executeJs: (
    prepared: TPrepared,
    matrixResultMode: MatrixResultMode | undefined,
  ) => ExecutionResult;
  executeRustSingle: (
    prepared: TPrepared,
    matrixResultMode: MatrixResultMode | undefined,
  ) => Promise<ExecutionResult>;
  executeRustNativeBatch?: (
    prepared: TPrepared,
    iterations: number,
    matrixResultMode: MatrixResultMode | undefined,
  ) => Promise<ExecutionResult>;
  supportsNativeBatch: (matrixResultMode: MatrixResultMode | undefined) => boolean;
}

type PrimePreparedInput = Extract<PreparedInput, { algorithm: "prime-count" }>;
type MatrixPreparedInput = Extract<PreparedInput, { algorithm: "matrix-multiply" }>;
type DotPreparedInput = Extract<PreparedInput, { algorithm: "dot-product" }>;

const primeCountWorkload: BenchmarkWorkloadModule<PrimePreparedInput> = {
  prepare(request) {
    const limit = request.workload.limit;
    if (typeof limit !== "number") {
      throw new Error("workload.limit is required for prime-count algorithm.");
    }

    return {
      algorithm: "prime-count",
      inputSize: limit,
      limit,
    };
  },

  executeJs(prepared) {
    return {
      resultSummary: summarizeResult(countPrimesJs(prepared.limit)),
    };
  },

  async executeRustSingle(prepared) {
    const timed = await runRustPrimeCountTimed(prepared.limit);
    return {
      resultSummary: summarizeResult(timed.value),
      computeMs: timed.computeMs,
    };
  },

  async executeRustNativeBatch(prepared, iterations) {
    const timed = await runRustPrimeCountBatchTimed(prepared.limit, iterations);
    return {
      resultSummary: summarizeResult(timed.value),
      computeMs: timed.computeMs,
    };
  },

  supportsNativeBatch() {
    return true;
  },
};

const matrixMultiplyWorkload: BenchmarkWorkloadModule<MatrixPreparedInput> = {
  prepare(request) {
    const size = request.workload.matrixSize;
    if (typeof size !== "number") {
      throw new Error("workload.matrixSize is required for matrix-multiply algorithm.");
    }

    const { left, right } = createMatrixInput(size);
    return {
      algorithm: "matrix-multiply",
      inputSize: size,
      size,
      left,
      right,
    };
  },

  resolveMatrixResultMode(request) {
    return request.resultMode ?? "summary";
  },

  executeJs(prepared, matrixResultMode) {
    if (matrixResultMode === "summary") {
      return {
        resultSummary: summarizeMatrixSummary(
          multiplyMatricesSummaryJs(prepared.left, prepared.right, prepared.size),
        ),
      };
    }

    return {
      resultSummary: summarizeResult(
        multiplyMatricesJs(prepared.left, prepared.right, prepared.size),
      ),
    };
  },

  async executeRustSingle(prepared, matrixResultMode) {
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

    return {
      resultSummary: summarizeResult(
        await runRustMatrixMultiply(prepared.left, prepared.right, prepared.size),
      ),
    };
  },

  async executeRustNativeBatch(prepared, iterations, matrixResultMode) {
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
  },

  supportsNativeBatch(matrixResultMode) {
    return matrixResultMode === "summary";
  },
};

const dotProductWorkload: BenchmarkWorkloadModule<DotPreparedInput> = {
  prepare(request) {
    const size = request.workload.vectorSize;
    if (typeof size !== "number") {
      throw new Error("workload.vectorSize is required for dot-product algorithm.");
    }

    const { left, right } = createVectorInput(size);
    return {
      algorithm: "dot-product",
      inputSize: size,
      left,
      right,
    };
  },

  executeJs(prepared) {
    return {
      resultSummary: summarizeResult(dotProductJs(prepared.left, prepared.right)),
    };
  },

  async executeRustSingle(prepared) {
    const timed = await runRustDotProductTimed(prepared.left, prepared.right);
    return {
      resultSummary: summarizeResult(timed.value),
      computeMs: timed.computeMs,
    };
  },

  async executeRustNativeBatch(prepared, iterations) {
    const timed = await runRustDotProductBatchTimed(
      prepared.left,
      prepared.right,
      iterations,
    );
    return {
      resultSummary: summarizeResult(timed.value),
      computeMs: timed.computeMs,
    };
  },

  supportsNativeBatch() {
    return true;
  },
};

const workloadModules = {
  "prime-count": primeCountWorkload,
  "matrix-multiply": matrixMultiplyWorkload,
  "dot-product": dotProductWorkload,
} as const;

function getWorkloadModule(
  algorithm: BenchmarkAlgorithm,
): BenchmarkWorkloadModule<PreparedInput> {
  return workloadModules[algorithm] as unknown as BenchmarkWorkloadModule<PreparedInput>;
}

export function prepareInput(request: BenchmarkRequestBody): PreparedInput {
  return getWorkloadModule(request.algorithm).prepare(request);
}

export function resolveMatrixResultMode(
  request: BenchmarkRequestBody,
): MatrixResultMode | undefined {
  return getWorkloadModule(request.algorithm).resolveMatrixResultMode?.(request);
}

export function executeJsWorkload(
  prepared: PreparedInput,
  matrixResultMode: MatrixResultMode | undefined,
): ExecutionResult {
  return getWorkloadModule(prepared.algorithm).executeJs(prepared, matrixResultMode);
}

export function executeRustSingleWorkload(
  prepared: PreparedInput,
  matrixResultMode: MatrixResultMode | undefined,
): Promise<ExecutionResult> {
  return getWorkloadModule(prepared.algorithm).executeRustSingle(
    prepared,
    matrixResultMode,
  );
}

export function executeRustNativeBatchWorkload(
  prepared: PreparedInput,
  iterations: number,
  matrixResultMode: MatrixResultMode | undefined,
): Promise<ExecutionResult> {
  const workload = getWorkloadModule(prepared.algorithm);
  if (!workload.executeRustNativeBatch) {
    throw new NativeAddonUnavailableError(
      `Native batching is not supported for ${prepared.algorithm}.`,
    );
  }

  return workload.executeRustNativeBatch(prepared, iterations, matrixResultMode);
}

export function supportsNativeBatch(
  algorithm: BenchmarkAlgorithm,
  matrixResultMode: MatrixResultMode | undefined,
): boolean {
  return getWorkloadModule(algorithm).supportsNativeBatch(matrixResultMode);
}
