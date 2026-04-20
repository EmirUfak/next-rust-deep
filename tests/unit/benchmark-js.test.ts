import {
  countPrimesJs,
  dotProductJs,
  multiplyMatricesJs,
  multiplyMatricesSummaryJs,
  summarizeMatrixSummary,
  summarizeResult,
} from "@/lib/benchmark-js";
import { describe, expect, it } from "vitest";

describe("benchmark-js", () => {
  it("counts primes up to a limit", () => {
    expect(countPrimesJs(30)).toBe(10);
  });

  it("multiplies matrices correctly", () => {
    const left = [1, 2, 3, 4];
    const right = [5, 6, 7, 8];

    expect(multiplyMatricesJs(left, right, 2)).toEqual([19, 22, 43, 50]);
  });

  it("computes dot product", () => {
    expect(dotProductJs([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it("summarizes number and array results", () => {
    expect(summarizeResult(42)).toBe("42");
    expect(summarizeResult([1, 2, 3])).toContain("len=3");
  });

  it("computes matrix summary without building output matrix", () => {
    const summary = multiplyMatricesSummaryJs([1, 2, 3, 4], [5, 6, 7, 8], 2);

    expect(summary).toEqual({
      length: 4,
      first: 19,
      checksum: 134,
    });
    expect(summarizeMatrixSummary(summary)).toBe(
      "len=4, first=19.0000, checksum=134.0000",
    );
  });
});
