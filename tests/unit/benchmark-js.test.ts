import {
  countPrimesJs,
  dotProductJs,
  multiplyMatricesJs,
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
});
