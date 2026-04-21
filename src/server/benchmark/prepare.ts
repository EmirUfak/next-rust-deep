import {
  createMatrixInput,
  createVectorInput,
} from "@/lib/benchmark-js";
import {
  type BenchmarkRequestBody,
  type MatrixResultMode,
} from "@/lib/benchmark-types";

import type { PreparedInput } from "./types";

export function prepareInput(request: BenchmarkRequestBody): PreparedInput {
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

export function resolveMatrixResultMode(
  request: BenchmarkRequestBody,
): MatrixResultMode | undefined {
  if (request.algorithm !== "matrix-multiply") {
    return undefined;
  }

  return request.resultMode ?? "summary";
}
