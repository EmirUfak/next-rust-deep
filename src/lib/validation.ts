import { z } from "zod";

import {
  type BenchmarkRequestBody,
  type BenchmarkWorkload,
  WORKLOAD_LIMITS,
} from "@/lib/benchmark-types";

const workloadSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(WORKLOAD_LIMITS.primeLimit.min)
      .max(WORKLOAD_LIMITS.primeLimit.max)
      .optional(),
    matrixSize: z
      .number()
      .int()
      .min(WORKLOAD_LIMITS.matrixSize.min)
      .max(WORKLOAD_LIMITS.matrixSize.max)
      .optional(),
    vectorSize: z
      .number()
      .int()
      .min(WORKLOAD_LIMITS.vectorSize.min)
      .max(WORKLOAD_LIMITS.vectorSize.max)
      .optional(),
  })
  .strict();

export const benchmarkRequestSchema = z
  .object({
    algorithm: z.enum(["prime-count", "matrix-multiply", "dot-product"]),
    implementation: z.enum(["js", "rust", "compare"]),
    iterations: z
      .number()
      .int()
      .min(WORKLOAD_LIMITS.iterations.min)
      .max(WORKLOAD_LIMITS.iterations.max),
    timeoutMs: z
      .number()
      .int()
      .min(WORKLOAD_LIMITS.timeoutMs.min)
      .max(WORKLOAD_LIMITS.timeoutMs.max)
      .optional(),
    workload: workloadSchema,
  })
  .strict()
  .superRefine((value, context) => {
    validateWorkloadByAlgorithm(value.algorithm, value.workload, context);
  });

function validateWorkloadByAlgorithm(
  algorithm: BenchmarkRequestBody["algorithm"],
  workload: BenchmarkWorkload,
  context: z.RefinementCtx,
): void {
  if (algorithm === "prime-count" && typeof workload.limit !== "number") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "workload.limit is required for prime-count algorithm.",
      path: ["workload", "limit"],
    });
  }

  if (
    algorithm === "matrix-multiply" &&
    typeof workload.matrixSize !== "number"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "workload.matrixSize is required for matrix-multiply algorithm.",
      path: ["workload", "matrixSize"],
    });
  }

  if (algorithm === "dot-product" && typeof workload.vectorSize !== "number") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "workload.vectorSize is required for dot-product algorithm.",
      path: ["workload", "vectorSize"],
    });
  }
}

export function parseBenchmarkRequest(
  payload: unknown,
): z.SafeParseReturnType<unknown, BenchmarkRequestBody> {
  return benchmarkRequestSchema.safeParse(payload);
}
