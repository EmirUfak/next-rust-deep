"use client";

import { BenchmarkHeader } from "@/components/benchmark/BenchmarkHeader";
import { DotBenchmarkCard } from "@/components/benchmark/DotBenchmarkCard";
import { HealthSettingsCard } from "@/components/benchmark/HealthSettingsCard";
import { MatrixBenchmarkCard } from "@/components/benchmark/MatrixBenchmarkCard";
import { PrimeBenchmarkCard } from "@/components/benchmark/PrimeBenchmarkCard";
import { useBenchmarkConsole } from "@/components/benchmark/useBenchmarkConsole";

export function BenchmarkConsole() {
  const state = useBenchmarkConsole();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#0f172a_45%,#020617_100%)] p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <BenchmarkHeader
          addonAvailable={state.addonHealth.available}
          timeoutMs={state.timeoutMs}
          rustBatching={state.rustBatching}
          matrixResultMode={state.matrixResultMode}
          isAnyLoading={state.isAnyLoading}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PrimeBenchmarkCard
            primeLimit={state.primeLimit}
            setPrimeLimit={state.setPrimeLimit}
            primeIterations={state.primeIterations}
            setPrimeIterations={state.setPrimeIterations}
            primeLoading={state.primeLoading}
            primeResult={state.primeResult}
            runPrimeComparison={state.runPrimeComparison}
          />

          <MatrixBenchmarkCard
            matrixSize={state.matrixSize}
            setMatrixSize={state.setMatrixSize}
            matrixIterations={state.matrixIterations}
            setMatrixIterations={state.setMatrixIterations}
            matrixLoading={state.matrixLoading}
            matrixResult={state.matrixResult}
            runMatrixComparison={state.runMatrixComparison}
            matrixResultMode={state.matrixResultMode}
          />

          <DotBenchmarkCard
            vectorSize={state.vectorSize}
            setVectorSize={state.setVectorSize}
            dotIterations={state.dotIterations}
            setDotIterations={state.setDotIterations}
            dotLoading={state.dotLoading}
            dotResult={state.dotResult}
            runDotComparison={state.runDotComparison}
          />

          <HealthSettingsCard
            addonHealth={state.addonHealth}
            timeoutMs={state.timeoutMs}
            setTimeoutMs={state.setTimeoutMs}
            rustBatching={state.rustBatching}
            setRustBatching={state.setRustBatching}
            matrixResultMode={state.matrixResultMode}
            setMatrixResultMode={state.setMatrixResultMode}
            primeRequestId={state.primeResult.requestId}
            matrixRequestId={state.matrixResult.requestId}
            dotRequestId={state.dotResult.requestId}
          />
        </div>

        {state.globalError ? (
          <div className="mt-6 rounded-lg border border-rose-800/60 bg-rose-950/40 p-4 text-center text-rose-200">
            Error: {state.globalError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
