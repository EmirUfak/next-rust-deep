"use client";

import { useEffect, useState } from "react";

import {
  type AddonHealth,
  type BenchmarkAlgorithm,
  type BenchmarkRequestBody,
  type BenchmarkResponseBody,
  type BenchmarkRunResult,
  type MatrixResultMode,
  type RustBatchingMode,
  WORKLOAD_LIMITS,
} from "@/lib/benchmark-types";

interface CaseResult {
  jsTime: number | null;
  rustTime: number | null;
  jsComputeMs: number | null;
  rustComputeMs: number | null;
  jsTransferMs: number | null;
  rustTransferMs: number | null;
  jsSummary: string | null;
  rustSummary: string | null;
  speedup: number | null;
  rustBatchMode: RustBatchingMode | null;
  rustCallbackCalls: number | null;
  error: string | null;
  requestId: string | null;
}

const emptyCaseResult: CaseResult = {
  jsTime: null,
  rustTime: null,
  jsComputeMs: null,
  rustComputeMs: null,
  jsTransferMs: null,
  rustTransferMs: null,
  jsSummary: null,
  rustSummary: null,
  speedup: null,
  rustBatchMode: null,
  rustCallbackCalls: null,
  error: null,
  requestId: null,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseIntSafe(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function findRun(
  runs: BenchmarkRunResult[],
  implementation: "js" | "rust",
): BenchmarkRunResult | undefined {
  return runs.find((run) => run.implementation === implementation);
}

function calculateSpeedup(
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

function getParityLabel(result: CaseResult): string {
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

function getSpeedupLabel(
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

function shortRequestId(requestId: string | null): string {
  if (!requestId) {
    return "-";
  }

  if (requestId.length <= 20) {
    return requestId;
  }

  return `${requestId.slice(0, 8)}...${requestId.slice(-8)}`;
}

function formatTiming(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(2)} ms`;
}

export function BenchmarkConsole() {
  const [primeLimit, setPrimeLimit] = useState(650_000);
  const [primeIterations, setPrimeIterations] = useState(3);

  const [matrixSize, setMatrixSize] = useState(96);
  const [matrixIterations, setMatrixIterations] = useState(3);

  const [vectorSize, setVectorSize] = useState(1_200_000);
  const [dotIterations, setDotIterations] = useState(3);

  const [timeoutMs, setTimeoutMs] = useState<number>(
    WORKLOAD_LIMITS.timeoutMs.default,
  );
  const [matrixResultMode, setMatrixResultMode] =
    useState<MatrixResultMode>("summary");
  const [rustBatching, setRustBatching] =
    useState<RustBatchingMode>("native");

  const [primeLoading, setPrimeLoading] = useState(false);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [dotLoading, setDotLoading] = useState(false);

  const [primeResult, setPrimeResult] = useState<CaseResult>(emptyCaseResult);
  const [matrixResult, setMatrixResult] = useState<CaseResult>(emptyCaseResult);
  const [dotResult, setDotResult] = useState<CaseResult>(emptyCaseResult);

  const [addonHealth, setAddonHealth] = useState<AddonHealth>({
    available: false,
  });
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/health/addon", { cache: "no-store" });
        const data = (await res.json()) as AddonHealth;

        if (isActive) {
          setAddonHealth(data);
        }
      } catch {
        if (isActive) {
          setAddonHealth({
            available: false,
            error: "Health check endpoint could not be reached.",
          });
        }
      }
    };

    fetchHealth().catch(() => {
      if (isActive) {
        setAddonHealth({
          available: false,
          error: "Health check request failed.",
        });
      }
    });

    const timer = window.setInterval(() => {
      fetchHealth().catch(() => {
        if (isActive) {
          setAddonHealth({
            available: false,
            error: "Health refresh failed.",
          });
        }
      });
    }, 20_000);

    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, []);

  const isAnyLoading = primeLoading || matrixLoading || dotLoading;

  async function runBenchmarkComparison(
    algorithm: BenchmarkAlgorithm,
    workload: BenchmarkRequestBody["workload"],
    iterations: number,
    setLoading: (value: boolean) => void,
    setResult: (result: CaseResult) => void,
    requestOptions?: {
      resultMode?: MatrixResultMode;
    },
  ): Promise<void> {
    setLoading(true);
    setGlobalError(null);

    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          algorithm,
          implementation: "compare",
          iterations,
          timeoutMs,
          rustBatching,
          resultMode: requestOptions?.resultMode,
          workload,
        }),
      });

      const payload = (await res.json()) as Partial<BenchmarkResponseBody>;

      if (!payload || !Array.isArray(payload.runs)) {
        setResult({
          ...emptyCaseResult,
          error: "Unexpected response contract from benchmark endpoint.",
        });
        return;
      }

      const typedPayload = payload as BenchmarkResponseBody;
      setAddonHealth(typedPayload.addon);

      const jsRun = findRun(typedPayload.runs, "js");
      const rustRun = findRun(typedPayload.runs, "rust");

      const jsTime = jsRun?.durationMs ?? null;
      const rustTime = rustRun?.durationMs ?? null;

      const caseError =
        typedPayload.error?.message ??
        jsRun?.error ??
        rustRun?.error ??
        (typedPayload.ok ? null : "Benchmark failed.");

      setResult({
        jsTime,
        rustTime,
        jsComputeMs: jsRun?.computeMs ?? null,
        rustComputeMs: rustRun?.computeMs ?? null,
        jsTransferMs: jsRun?.transferMs ?? null,
        rustTransferMs: rustRun?.transferMs ?? null,
        jsSummary: jsRun?.resultSummary ?? null,
        rustSummary: rustRun?.resultSummary ?? null,
        speedup: calculateSpeedup(jsTime, rustTime),
        rustBatchMode: rustRun?.batchMode ?? null,
        rustCallbackCalls: rustRun?.callbackCalls ?? null,
        requestId: typedPayload.requestId,
        error: caseError,
      });

      if (caseError) {
        setGlobalError(caseError);
      }
    } catch {
      const message =
        "Benchmark request failed. Verify the dev server is running.";
      setResult({
        ...emptyCaseResult,
        error: message,
      });
      setGlobalError(message);
    } finally {
      setLoading(false);
    }
  }

  const runPrimeComparison = () =>
    runBenchmarkComparison(
      "prime-count",
      { limit: primeLimit },
      primeIterations,
      setPrimeLoading,
      setPrimeResult,
    );

  const runMatrixComparison = () =>
    runBenchmarkComparison(
      "matrix-multiply",
      { matrixSize },
      matrixIterations,
      setMatrixLoading,
      setMatrixResult,
      {
        resultMode: matrixResultMode,
      },
    );

  const runDotComparison = () =>
    runBenchmarkComparison(
      "dot-product",
      { vectorSize },
      dotIterations,
      setDotLoading,
      setDotResult,
    );

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            next-rust-deep Template
            <a
              href="https://github.com/emirufak/next-rust-deep"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-800 text-white text-sm rounded-full hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </h1>
          <div className="flex flex-wrap justify-center gap-4 text-gray-500 text-sm">
            <span className="whitespace-nowrap">
              Node runtime | NAPI-RS addon | JS vs Rust comparisons
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              Addon: <span className="font-bold text-gray-600">{addonHealth.available ? "Yes" : "No"}</span>
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              Timeout: <span className="font-bold text-gray-600">{timeoutMs} ms</span>
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              Rust batching: <span className="font-bold text-gray-600">{rustBatching}</span>
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              Matrix mode: <span className="font-bold text-gray-600">{matrixResultMode}</span>
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              Status: <span className="font-bold text-gray-600">{isAnyLoading ? "Running" : "Ready"}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 min-h-88 flex flex-col">
            <h2 className="text-xl font-bold text-blue-600 mb-1 flex items-center gap-2">
              Prime Counting
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              Compare JS baseline and Rust addon with the same upper limit.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-500">Prime limit</label>
                <input
                  type="number"
                  min={WORKLOAD_LIMITS.primeLimit.min}
                  max={WORKLOAD_LIMITS.primeLimit.max}
                  value={primeLimit}
                  onChange={(event) =>
                    setPrimeLimit(
                      clamp(
                        parseIntSafe(event.target.value, primeLimit),
                        WORKLOAD_LIMITS.primeLimit.min,
                        WORKLOAD_LIMITS.primeLimit.max,
                      ),
                    )
                  }
                  className="w-full p-2 border rounded-lg bg-gray-50 text-gray-800"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Iterations</label>
                <input
                  type="number"
                  min={WORKLOAD_LIMITS.iterations.min}
                  max={WORKLOAD_LIMITS.iterations.max}
                  value={primeIterations}
                  onChange={(event) =>
                    setPrimeIterations(
                      clamp(
                        parseIntSafe(event.target.value, primeIterations),
                        WORKLOAD_LIMITS.iterations.min,
                        WORKLOAD_LIMITS.iterations.max,
                      ),
                    )
                  }
                  className="w-full p-2 border rounded-lg bg-gray-50 text-gray-800"
                />
              </div>
            </div>
            <button
              onClick={runPrimeComparison}
              disabled={primeLoading}
              className="w-full py-3 bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all mb-4"
            >
              {primeLoading ? "Running..." : "Run Comparison"}
            </button>

            <div className="flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div className="bg-yellow-50 p-3 rounded-lg text-center">
                  <div className="text-sm text-yellow-700 font-medium">JavaScript</div>
                  <div className="text-xl font-bold text-yellow-600">{primeResult.jsSummary ?? "-"}</div>
                  <div className="text-sm text-yellow-600">{primeResult.jsTime?.toFixed(1) ?? "-"} ms</div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <div className="text-sm text-orange-700 font-medium">Rust (NAPI)</div>
                  <div className="text-xl font-bold text-orange-600">{primeResult.rustSummary ?? "-"}</div>
                  <div className="text-sm text-orange-600">{primeResult.rustTime?.toFixed(1) ?? "-"} ms</div>
                </div>
              </div>
              <div className="text-center text-green-600 font-medium min-h-6">
                {getSpeedupLabel(primeResult.jsTime, primeResult.rustTime)}
              </div>
              <div className="text-center text-xs text-gray-500">
                JS compute/transfer: {formatTiming(primeResult.jsComputeMs)} / {formatTiming(primeResult.jsTransferMs)}
              </div>
              <div className="text-center text-xs text-gray-500 mb-1">
                Rust compute/transfer: {formatTiming(primeResult.rustComputeMs)} / {formatTiming(primeResult.rustTransferMs)}
              </div>
              {primeResult.error ? (
                <p className="text-center text-xs text-red-600">{primeResult.error}</p>
              ) : null}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 min-h-88 flex flex-col">
            <h2 className="text-xl font-bold text-red-500 mb-1 flex items-center gap-2">
              Matrix Multiplication
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              Multiply N x N matrices and compare JS against Rust addon output.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-500">Matrix size (N x N)</label>
                <input
                  type="number"
                  min={WORKLOAD_LIMITS.matrixSize.min}
                  max={WORKLOAD_LIMITS.matrixSize.max}
                  value={matrixSize}
                  onChange={(event) =>
                    setMatrixSize(
                      clamp(
                        parseIntSafe(event.target.value, matrixSize),
                        WORKLOAD_LIMITS.matrixSize.min,
                        WORKLOAD_LIMITS.matrixSize.max,
                      ),
                    )
                  }
                  className="w-full p-2 border rounded-lg bg-gray-50 text-gray-800"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Iterations</label>
              <input
                type="number"
                  min={WORKLOAD_LIMITS.iterations.min}
                  max={WORKLOAD_LIMITS.iterations.max}
                  value={matrixIterations}
                onChange={(event) =>
                    setMatrixIterations(
                      clamp(
                        parseIntSafe(event.target.value, matrixIterations),
                        WORKLOAD_LIMITS.iterations.min,
                        WORKLOAD_LIMITS.iterations.max,
                      ),
                    )
                  }
                  className="w-full p-2 border rounded-lg bg-gray-50 text-gray-800"
                />
              </div>
            </div>
            <button
              onClick={runMatrixComparison}
              disabled={matrixLoading}
              className="w-full py-3 bg-linear-to-r from-red-500 to-orange-500 text-white rounded-lg font-medium hover:from-red-600 hover:to-orange-600 disabled:opacity-50 transition-all mb-4"
            >
              {matrixLoading ? "Running..." : "Run Comparison"}
            </button>

            <div className="flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div className="bg-yellow-50 p-3 rounded-lg text-center">
                  <div className="text-sm text-yellow-700 font-medium">JavaScript</div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {matrixResult.jsTime?.toFixed(1) ?? "-"}
                    <span className="text-sm"> ms</span>
                  </div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <div className="text-sm text-orange-700 font-medium">Rust (NAPI)</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {matrixResult.rustTime?.toFixed(1) ?? "-"}
                    <span className="text-sm"> ms</span>
                  </div>
                </div>
              </div>
              <div className="text-center text-green-600 font-medium min-h-6">
                {getSpeedupLabel(matrixResult.jsTime, matrixResult.rustTime)}
              </div>
              <div className="text-center text-xs text-gray-500 mb-1">
                Result parity: {getParityLabel(matrixResult)}
              </div>
              <div className="text-center text-xs text-gray-500">
                JS compute/transfer: {formatTiming(matrixResult.jsComputeMs)} / {formatTiming(matrixResult.jsTransferMs)}
              </div>
              <div className="text-center text-xs text-gray-500">
                Rust compute/transfer: {formatTiming(matrixResult.rustComputeMs)} / {formatTiming(matrixResult.rustTransferMs)}
              </div>
              <div className="text-center text-xs text-gray-500 mb-1">
                Rust batch: {matrixResult.rustBatchMode ?? "n/a"} ({matrixResult.rustCallbackCalls ?? 0} callback)
              </div>
              {matrixResult.error ? (
                <p className="text-center text-xs text-red-600">{matrixResult.error}</p>
              ) : null}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 min-h-88 flex flex-col">
            <h2 className="text-xl font-bold text-purple-600 mb-1 flex items-center gap-2">
              Vector Dot Product
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              Process large vector workloads and compare JS and Rust timing.
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Includes JS to native data transfer cost for Rust calls.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-500">Vector size</label>
                <input
                  type="number"
                  min={WORKLOAD_LIMITS.vectorSize.min}
                  max={WORKLOAD_LIMITS.vectorSize.max}
                  value={vectorSize}
                  onChange={(event) =>
                    setVectorSize(
                      clamp(
                        parseIntSafe(event.target.value, vectorSize),
                        WORKLOAD_LIMITS.vectorSize.min,
                        WORKLOAD_LIMITS.vectorSize.max,
                      ),
                    )
                  }
                  className="w-full p-2 border rounded-lg bg-gray-50 text-gray-800"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Iterations</label>
                <input
                  type="number"
                  min={WORKLOAD_LIMITS.iterations.min}
                  max={WORKLOAD_LIMITS.iterations.max}
                  value={dotIterations}
                  onChange={(event) =>
                    setDotIterations(
                      clamp(
                        parseIntSafe(event.target.value, dotIterations),
                        WORKLOAD_LIMITS.iterations.min,
                        WORKLOAD_LIMITS.iterations.max,
                      ),
                    )
                  }
                  className="w-full p-2 border rounded-lg bg-gray-50 text-gray-800"
                />
              </div>
            </div>
            <button
              onClick={runDotComparison}
              disabled={dotLoading}
              className="w-full py-3 bg-linear-to-r from-yellow-400 to-orange-500 text-white rounded-lg font-medium hover:from-yellow-500 hover:to-orange-600 disabled:opacity-50 transition-all mb-4"
            >
              {dotLoading ? "Running..." : "Run Comparison"}
            </button>

            <div className="flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div className="bg-yellow-50 p-3 rounded-lg text-center">
                  <div className="text-sm text-yellow-700 font-medium">JavaScript</div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {dotResult.jsTime?.toFixed(1) ?? "-"}
                    <span className="text-sm"> ms</span>
                  </div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <div className="text-sm text-orange-700 font-medium">Rust (NAPI)</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {dotResult.rustTime?.toFixed(1) ?? "-"}
                    <span className="text-sm"> ms</span>
                  </div>
                </div>
              </div>
              <div className="text-center text-green-600 font-medium min-h-6">
                {getSpeedupLabel(dotResult.jsTime, dotResult.rustTime)}
              </div>
              <div className="text-center text-xs text-gray-500 mb-1">
                Result parity: {getParityLabel(dotResult)}
              </div>
              <div className="text-center text-xs text-gray-500">
                JS compute/transfer: {formatTiming(dotResult.jsComputeMs)} / {formatTiming(dotResult.jsTransferMs)}
              </div>
              <div className="text-center text-xs text-gray-500">
                Rust compute/transfer: {formatTiming(dotResult.rustComputeMs)} / {formatTiming(dotResult.rustTransferMs)}
              </div>
              <div className="text-center text-xs text-gray-500 mb-1">
                Rust batch: {dotResult.rustBatchMode ?? "n/a"} ({dotResult.rustCallbackCalls ?? 0} callback)
              </div>
              {dotResult.error ? (
                <p className="text-center text-xs text-red-600">{dotResult.error}</p>
              ) : null}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 min-h-88 flex flex-col">
            <h2 className="text-xl font-bold text-teal-600 mb-1 flex items-center gap-2">
              Native Addon Health
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Verifies whether the Rust native binary can be loaded by the Node runtime.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              If this card is unavailable, Rust benchmarks fail and only JS side can run.
            </p>

            <label className="text-sm text-gray-500 mb-2">Timeout (ms)</label>
            <input
              type="number"
              min={WORKLOAD_LIMITS.timeoutMs.min}
              max={WORKLOAD_LIMITS.timeoutMs.max}
              value={timeoutMs}
              onChange={(event) =>
                setTimeoutMs(
                  clamp(
                    parseIntSafe(event.target.value, timeoutMs),
                    WORKLOAD_LIMITS.timeoutMs.min,
                    WORKLOAD_LIMITS.timeoutMs.max,
                  ),
                )
              }
              className="w-full p-2 border rounded-lg bg-gray-50 text-gray-800 mb-4"
            />

            <label className="text-sm text-gray-500 mb-2">Rust batching mode</label>
            <select
              value={rustBatching}
              onChange={(event) =>
                setRustBatching(event.target.value as RustBatchingMode)
              }
              className="w-full p-2 border rounded-lg bg-gray-50 text-gray-800 mb-3"
            >
              <option value="native">native</option>
              <option value="none">none</option>
            </select>

            <label className="text-sm text-gray-500 mb-2">Matrix result mode</label>
            <select
              value={matrixResultMode}
              onChange={(event) =>
                setMatrixResultMode(event.target.value as MatrixResultMode)
              }
              className="w-full p-2 border rounded-lg bg-gray-50 text-gray-800 mb-4"
            >
              <option value="summary">summary</option>
              <option value="full">full</option>
            </select>

            <div className="flex-1 flex items-center justify-center">
              <div className="bg-green-50 rounded-lg p-6 text-center w-full">
                <div className="text-green-600 font-medium mb-1">
                  {addonHealth.available ? "Addon Available" : "Addon Unavailable"}
                </div>
                <div className="text-xs text-green-700 mb-2">
                  Endpoint: /api/health/addon
                </div>
                <div className="text-xs text-green-700 mb-2 break-all" title={primeResult.requestId ?? undefined}>
                  Prime request: {shortRequestId(primeResult.requestId)}
                </div>
                <div className="text-xs text-green-700 mb-2 break-all" title={matrixResult.requestId ?? undefined}>
                  Matrix request: {shortRequestId(matrixResult.requestId)}
                </div>
                <div className="text-xs text-green-700 mb-2 break-all" title={dotResult.requestId ?? undefined}>
                  Dot request: {shortRequestId(dotResult.requestId)}
                </div>
                {addonHealth.error ? (
                  <div className="text-xs text-red-600 mt-3">{addonHealth.error}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {globalError ? (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg text-center">
            Error: {globalError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
