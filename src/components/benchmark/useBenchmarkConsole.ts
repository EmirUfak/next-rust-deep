"use client";

import { useEffect, useState } from "react";

import {
  type AddonHealth,
  type BenchmarkAlgorithm,
  type BenchmarkRequestBody,
  type BenchmarkResponseBody,
  type MatrixResultMode,
  type RustBatchingMode,
  WORKLOAD_LIMITS,
} from "@/lib/benchmark-types";

import { calculateSpeedup, findRun } from "./utils";
import { type CaseResult, emptyCaseResult } from "./types";

interface RequestOptions {
  resultMode?: MatrixResultMode;
}

export interface BenchmarkConsoleState {
  primeLimit: number;
  setPrimeLimit: (value: number) => void;
  primeIterations: number;
  setPrimeIterations: (value: number) => void;
  matrixSize: number;
  setMatrixSize: (value: number) => void;
  matrixIterations: number;
  setMatrixIterations: (value: number) => void;
  vectorSize: number;
  setVectorSize: (value: number) => void;
  dotIterations: number;
  setDotIterations: (value: number) => void;
  timeoutMs: number;
  setTimeoutMs: (value: number) => void;
  matrixResultMode: MatrixResultMode;
  setMatrixResultMode: (value: MatrixResultMode) => void;
  rustBatching: RustBatchingMode;
  setRustBatching: (value: RustBatchingMode) => void;
  primeLoading: boolean;
  matrixLoading: boolean;
  dotLoading: boolean;
  isAnyLoading: boolean;
  primeResult: CaseResult;
  matrixResult: CaseResult;
  dotResult: CaseResult;
  addonHealth: AddonHealth;
  globalError: string | null;
  runPrimeComparison: () => Promise<void>;
  runMatrixComparison: () => Promise<void>;
  runDotComparison: () => Promise<void>;
}

export function useBenchmarkConsole(): BenchmarkConsoleState {
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

  async function runBenchmarkComparison(
    algorithm: BenchmarkAlgorithm,
    workload: BenchmarkRequestBody["workload"],
    iterations: number,
    setLoading: (value: boolean) => void,
    setResult: (result: CaseResult) => void,
    requestOptions?: RequestOptions,
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

  const isAnyLoading = primeLoading || matrixLoading || dotLoading;

  return {
    primeLimit,
    setPrimeLimit,
    primeIterations,
    setPrimeIterations,
    matrixSize,
    setMatrixSize,
    matrixIterations,
    setMatrixIterations,
    vectorSize,
    setVectorSize,
    dotIterations,
    setDotIterations,
    timeoutMs,
    setTimeoutMs,
    matrixResultMode,
    setMatrixResultMode,
    rustBatching,
    setRustBatching,
    primeLoading,
    matrixLoading,
    dotLoading,
    isAnyLoading,
    primeResult,
    matrixResult,
    dotResult,
    addonHealth,
    globalError,
    runPrimeComparison,
    runMatrixComparison,
    runDotComparison,
  };
}
