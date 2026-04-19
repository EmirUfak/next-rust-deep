"use client";

import { useEffect, useMemo, useState } from "react";

import {
  type AddonHealth,
  type BenchmarkAlgorithm,
  type BenchmarkMode,
  type BenchmarkResponseBody,
  WORKLOAD_LIMITS,
} from "@/lib/benchmark-types";

const algorithmOptions: Array<{ value: BenchmarkAlgorithm; label: string }> = [
  { value: "prime-count", label: "Prime Counting" },
  { value: "matrix-multiply", label: "Matrix Multiply" },
  { value: "dot-product", label: "Vector Dot Product" },
];

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

export function BenchmarkConsole() {
  const [algorithm, setAlgorithm] = useState<BenchmarkAlgorithm>("prime-count");
  const [primeLimit, setPrimeLimit] = useState(650_000);
  const [matrixSize, setMatrixSize] = useState(96);
  const [vectorSize, setVectorSize] = useState(350_000);
  const [iterations, setIterations] = useState(3);
  const [timeoutMs, setTimeoutMs] = useState<number>(
    WORKLOAD_LIMITS.timeoutMs.default,
  );

  const [addonHealth, setAddonHealth] = useState<AddonHealth>({
    available: false,
  });
  const [response, setResponse] = useState<BenchmarkResponseBody | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const workload = useMemo(() => {
    if (algorithm === "prime-count") {
      return { limit: primeLimit };
    }

    if (algorithm === "matrix-multiply") {
      return { matrixSize };
    }

    return { vectorSize };
  }, [algorithm, matrixSize, primeLimit, vectorSize]);

  async function runBenchmark(mode: BenchmarkMode): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          algorithm,
          implementation: mode,
          iterations,
          timeoutMs,
          workload,
        }),
      });

      const payload = (await res.json()) as Partial<BenchmarkResponseBody>;

      if (!payload || !Array.isArray(payload.runs)) {
        setResponse(null);
        setErrorMessage(
          "Unexpected response contract from benchmark endpoint.",
        );
        return;
      }

      const typedPayload = payload as BenchmarkResponseBody;
      setResponse(typedPayload);
      setAddonHealth(typedPayload.addon);

      if (!typedPayload.ok) {
        setErrorMessage(
          typedPayload.error?.message ??
            "One or more benchmark runs failed. See result cards for details.",
        );
      }
    } catch {
      setResponse(null);
      setErrorMessage(
        "Benchmark request failed. Verify the dev server is running.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900">
            Benchmark Controls
          </h2>
          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                addonHealth.available ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            <span>
              Native addon: {addonHealth.available ? "Ready" : "Unavailable"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
              Algorithm
            </span>
            <select
              value={algorithm}
              onChange={(event) =>
                setAlgorithm(event.target.value as BenchmarkAlgorithm)
              }
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500"
            >
              {algorithmOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {algorithm === "prime-count" && (
            <label className="flex flex-col gap-2">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Prime Limit
              </span>
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
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500"
              />
            </label>
          )}

          {algorithm === "matrix-multiply" && (
            <label className="flex flex-col gap-2">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Matrix Size (N x N)
              </span>
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
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500"
              />
            </label>
          )}

          {algorithm === "dot-product" && (
            <label className="flex flex-col gap-2">
              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                Vector Size
              </span>
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
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500"
              />
            </label>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
              Iterations
            </span>
            <input
              type="number"
              min={WORKLOAD_LIMITS.iterations.min}
              max={WORKLOAD_LIMITS.iterations.max}
              value={iterations}
              onChange={(event) =>
                setIterations(
                  clamp(
                    parseIntSafe(event.target.value, iterations),
                    WORKLOAD_LIMITS.iterations.min,
                    WORKLOAD_LIMITS.iterations.max,
                  ),
                )
              }
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
              Timeout (ms)
            </span>
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
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => runBenchmark("js")}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run JS Baseline
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => runBenchmark("rust")}
            className="inline-flex items-center justify-center rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run Rust NAPI
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => runBenchmark("compare")}
            className="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run Comparative Benchmark
          </button>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900">Results</h3>
        {isLoading ? (
          <p className="mt-4 text-sm text-gray-600">Running benchmark...</p>
        ) : null}

        {!isLoading && !response ? (
          <p className="mt-4 text-sm text-gray-600">
            Choose parameters and run one of the benchmark actions.
          </p>
        ) : null}

        {response ? (
          <div className="mt-4 space-y-3">
            {response.runs.map((run) => (
              <article
                key={`${run.implementation}-${run.inputSize}`}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold tracking-[0.12em] text-gray-700 uppercase">
                    {run.implementation}
                  </p>
                  <p className="font-mono text-sm text-gray-800">
                    {run.durationMs.toFixed(3)} ms
                  </p>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Input: {run.inputSize.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Summary: {run.resultSummary}
                </p>
                {run.error ? (
                  <p className="mt-2 text-xs text-red-600">
                    Error: {run.error}
                  </p>
                ) : null}
              </article>
            ))}

            {response.comparison ? (
              <article className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs tracking-[0.15em] text-blue-700 uppercase">
                  Speedup Analysis
                </p>
                <p className="mt-1 text-sm font-semibold text-blue-900">
                  Faster: {response.comparison.faster.toUpperCase()}
                </p>
                <p className="mt-1 text-xs text-blue-800">
                  Speedup Ratio: {response.comparison.speedupRatio ?? "n/a"}
                </p>
              </article>
            ) : null}

            <p className="text-xs text-gray-500">
              Request: {response.requestId} | Iterations: {response.iterations}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
