import { WORKLOAD_LIMITS } from "@/lib/benchmark-types";

import { type CaseResult } from "./types";
import { clamp, formatTiming, getSpeedupLabel, parseIntSafe } from "./utils";

interface PrimeBenchmarkCardProps {
  primeLimit: number;
  setPrimeLimit: (value: number) => void;
  primeIterations: number;
  setPrimeIterations: (value: number) => void;
  primeLoading: boolean;
  primeResult: CaseResult;
  runPrimeComparison: () => Promise<void>;
}

export function PrimeBenchmarkCard(props: PrimeBenchmarkCardProps) {
  const {
    primeLimit,
    setPrimeLimit,
    primeIterations,
    setPrimeIterations,
    primeLoading,
    primeResult,
    runPrimeComparison,
  } = props;

  return (
    <div className="min-h-88 flex flex-col rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-cyan-300">
        Prime Counting
      </h2>
      <p className="mb-3 text-sm text-slate-400">
        Compare JS baseline and Rust addon with the same upper limit.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-sm text-slate-400">Prime limit</label>
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
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400">Iterations</label>
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
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
          />
        </div>
      </div>
      <button
        onClick={() => {
          void runPrimeComparison();
        }}
        disabled={primeLoading}
        className="mb-4 w-full rounded-lg bg-linear-to-r from-cyan-600 to-blue-700 py-3 font-medium text-white transition-all hover:from-cyan-500 hover:to-blue-600 disabled:opacity-50"
      >
        {primeLoading ? "Running..." : "Run Comparison"}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="rounded-lg border border-amber-800/40 bg-amber-950/40 p-3 text-center">
            <div className="text-sm font-medium text-amber-200">JavaScript</div>
            <div className="text-xl font-bold text-amber-300">{primeResult.jsSummary ?? "-"}</div>
            <div className="text-sm text-amber-200">{primeResult.jsTime?.toFixed(1) ?? "-"} ms</div>
          </div>
          <div className="rounded-lg border border-orange-800/40 bg-orange-950/40 p-3 text-center">
            <div className="text-sm font-medium text-orange-200">Rust (NAPI)</div>
            <div className="text-xl font-bold text-orange-300">{primeResult.rustSummary ?? "-"}</div>
            <div className="text-sm text-orange-200">{primeResult.rustTime?.toFixed(1) ?? "-"} ms</div>
          </div>
        </div>
        <div className="min-h-6 text-center font-medium text-emerald-300">
          {getSpeedupLabel(primeResult.jsTime, primeResult.rustTime)}
        </div>
        <div className="text-center text-xs text-slate-400">
          JS compute/transfer: {formatTiming(primeResult.jsComputeMs)} / {formatTiming(primeResult.jsTransferMs)}
        </div>
        <div className="mb-1 text-center text-xs text-slate-400">
          Rust compute/transfer: {formatTiming(primeResult.rustComputeMs)} / {formatTiming(primeResult.rustTransferMs)}
        </div>
        {primeResult.error ? (
          <p className="text-center text-xs text-rose-300">{primeResult.error}</p>
        ) : null}
      </div>
    </div>
  );
}
