import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  executeJsWorkload,
  prepareInput,
  resolveMatrixResultMode,
  supportsNativeBatch,
} from "@/server/benchmark/workloads";

describe("benchmark workloads", () => {
  it("prepares prime-count input behind the workload module", () => {
    const prepared = prepareInput({
      algorithm: "prime-count",
      implementation: "js",
      iterations: 1,
      workload: {
        limit: 97,
      },
    });

    expect(prepared).toMatchObject({
      algorithm: "prime-count",
      inputSize: 97,
      limit: 97,
    });
  });

  it("defaults matrix result mode to summary", () => {
    const mode = resolveMatrixResultMode({
      algorithm: "matrix-multiply",
      implementation: "compare",
      iterations: 1,
      workload: {
        matrixSize: 8,
      },
    });

    expect(mode).toBe("summary");
  });

  it("runs matrix JS summary through the workload interface", () => {
    const prepared = prepareInput({
      algorithm: "matrix-multiply",
      implementation: "js",
      iterations: 1,
      workload: {
        matrixSize: 8,
      },
    });

    const result = executeJsWorkload(prepared, "summary");

    expect(result.resultSummary).toMatch(/^len=64, first=/);
  });

  it("keeps native batching policy local to the workload module", () => {
    expect(supportsNativeBatch("prime-count", undefined)).toBe(true);
    expect(supportsNativeBatch("dot-product", undefined)).toBe(true);
    expect(supportsNativeBatch("matrix-multiply", "summary")).toBe(true);
    expect(supportsNativeBatch("matrix-multiply", "full")).toBe(false);
  });
});
