import { type BenchmarkRunResult } from "@/lib/benchmark-types";

import { type CaseResult } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function parseIntSafe(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

export function findRun(
  runs: BenchmarkRunResult[],
  implementation: "js" | "rust",
): BenchmarkRunResult | undefined {
  return runs.find((run) => run.implementation === implementation);
}

export function calculateSpeedup(
  jsTime: number | null,
  rustTime: number | null,
): number | null {
  if (jsTime === null || rustTime === null || rustTime === 0) {
    return null;
  }

  return jsTime / rustTime;
}

function parseArraySummary(value: string): {
  length: number;
  first: number;
  checksum: number;
} | null {
  const match = /^len=(\d+), first=([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?), checksum=([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)$/.exec(
    value.trim(),
  );

  if (!match) {
    return null;
  }

  return {
    length: Number.parseInt(match[1], 10),
    first: Number.parseFloat(match[2]),
    checksum: Number.parseFloat(match[3]),
  };
}

function nearlyEqual(left: number, right: number, epsilon = 0.01): boolean {
  return Math.abs(left - right) <= epsilon;
}

export function getParityLabel(result: CaseResult): string {
  if (!result.jsSummary || !result.rustSummary) {
    return "n/a";
  }

  if (result.jsSummary === result.rustSummary) {
    return "match";
  }

  const jsSummary = parseArraySummary(result.jsSummary);
  const rustSummary = parseArraySummary(result.rustSummary);

  if (!jsSummary || !rustSummary) {
    return "mismatch";
  }

  if (jsSummary.length !== rustSummary.length) {
    return "mismatch";
  }

  return nearlyEqual(jsSummary.first, rustSummary.first) &&
    nearlyEqual(jsSummary.checksum, rustSummary.checksum)
    ? "match"
    : "mismatch";
}

export function getSpeedupLabel(
  jsTime: number | null,
  rustTime: number | null,
): string {
  if (
    jsTime === null ||
    rustTime === null ||
    jsTime <= 0 ||
    rustTime <= 0
  ) {
    return "";
  }

  const displayedJs = Number(jsTime.toFixed(1));
  const displayedRust = Number(rustTime.toFixed(1));

  if (displayedJs === displayedRust) {
    return "JS and Rust are effectively equal.";
  }

  if (displayedRust < displayedJs) {
    return `Rust is ${(jsTime / rustTime).toFixed(1)}x faster.`;
  }

  return `JS is ${(rustTime / jsTime).toFixed(1)}x faster.`;
}

export function shortRequestId(requestId: string | null): string {
  if (!requestId) {
    return "-";
  }

  if (requestId.length <= 20) {
    return requestId;
  }

  return `${requestId.slice(0, 8)}...${requestId.slice(-8)}`;
}

export function formatTiming(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(2)} ms`;
}
