import { WORKLOAD_LIMITS } from "@/lib/benchmark-types";

import { type CaseResult } from "./types";
import {
  clamp,
  formatTiming,
  getParityLabel,
  getSpeedupLabel,
  parseIntSafe,
} from "./utils";

interface DotBenchmarkCardProps {
  vectorSize: number;
  setVectorSize: (value: number) => void;
  dotIterations: number;
  setDotIterations: (value: number) => void;
  dotLoading: boolean;
  dotResult: CaseResult;
  runDotComparison: () => Promise<void>;
}

export function DotBenchmarkCard(props: DotBenchmarkCardProps) {
  const {
    vectorSize,
    setVectorSize,
    dotIterations,
    setDotIterations,
    dotLoading,
    dotResult,
    runDotComparison,
  } = props;

  return (
    <div className="min-h-88 flex flex-col rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-violet-300">
        Vector Dot Product
      </h2>
      <p className="mb-3 text-sm text-slate-400">
        Process large vector workloads and compare JS and Rust timing.
      </p>
      <p className="mb-3 text-xs text-slate-400">
        Includes JS to native data transfer cost for Rust calls.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-sm text-slate-400">Vector size</label>
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
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400">Iterations</label>
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
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
          />
        </div>
      </div>
      <button
        onClick={() => {
          void runDotComparison();
        }}
        disabled={dotLoading}
        className="mb-4 w-full rounded-lg bg-linear-to-r from-amber-500 to-orange-600 py-3 font-medium text-white transition-all hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
      >
        {dotLoading ? "Running..." : "Run Comparison"}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="rounded-lg border border-amber-800/40 bg-amber-950/40 p-3 text-center">
            <div className="text-sm font-medium text-amber-200">JavaScript</div>
            <div className="text-2xl font-bold text-amber-300">
              {dotResult.jsTime?.toFixed(1) ?? "-"}
              <span className="text-sm"> ms</span>
            </div>
          </div>
          <div className="rounded-lg border border-orange-800/40 bg-orange-950/40 p-3 text-center">
            <div className="text-sm font-medium text-orange-200">Rust (NAPI)</div>
            <div className="text-2xl font-bold text-orange-300">
              {dotResult.rustTime?.toFixed(1) ?? "-"}
              <span className="text-sm"> ms</span>
            </div>
          </div>
        </div>
        <div className="min-h-6 text-center font-medium text-emerald-300">
          {getSpeedupLabel(dotResult.jsTime, dotResult.rustTime)}
        </div>
        <div className="mb-1 text-center text-xs text-slate-400">
          Result parity: {getParityLabel(dotResult)}
        </div>
        <div className="text-center text-xs text-slate-400">
          JS compute/transfer: {formatTiming(dotResult.jsComputeMs)} / {formatTiming(dotResult.jsTransferMs)}
        </div>
        <div className="text-center text-xs text-slate-400">
          Rust compute/transfer: {formatTiming(dotResult.rustComputeMs)} / {formatTiming(dotResult.rustTransferMs)}
        </div>
        <div className="mb-1 text-center text-xs text-slate-400">
          Rust batch: {dotResult.rustBatchMode ?? "n/a"} ({dotResult.rustCallbackCalls ?? 0} callback)
        </div>
        {dotResult.error ? (
          <p className="text-center text-xs text-rose-300">{dotResult.error}</p>
        ) : null}
      </div>
    </div>
  );
}
