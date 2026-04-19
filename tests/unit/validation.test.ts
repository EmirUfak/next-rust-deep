import { parseBenchmarkRequest } from "@/lib/validation";
import { describe, expect, it } from "vitest";

describe("benchmark request validation", () => {
  it("accepts valid prime-count request", () => {
    const parsed = parseBenchmarkRequest({
      algorithm: "prime-count",
      implementation: "compare",
      iterations: 3,
      timeoutMs: 5_000,
      workload: {
        limit: 500_000,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects missing workload for algorithm", () => {
    const parsed = parseBenchmarkRequest({
      algorithm: "prime-count",
      implementation: "js",
      iterations: 1,
      workload: {},
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects oversized matrix input", () => {
    const parsed = parseBenchmarkRequest({
      algorithm: "matrix-multiply",
      implementation: "rust",
      iterations: 2,
      workload: {
        matrixSize: 99_999,
      },
    });

    expect(parsed.success).toBe(false);
  });
});
