import {
  type MatrixResultMode,
  WORKLOAD_LIMITS,
} from "@/lib/benchmark-types";

import { type CaseResult } from "./types";
import {
  clamp,
  formatTiming,
  getParityLabel,
  getSpeedupLabel,
  parseIntSafe,
} from "./utils";

interface MatrixBenchmarkCardProps {
  matrixSize: number;
  setMatrixSize: (value: number) => void;
  matrixIterations: number;
  setMatrixIterations: (value: number) => void;
  matrixLoading: boolean;
  matrixResult: CaseResult;
  runMatrixComparison: () => Promise<void>;
  matrixResultMode: MatrixResultMode;
}

export function MatrixBenchmarkCard(props: MatrixBenchmarkCardProps) {
  const {
    matrixSize,
    setMatrixSize,
    matrixIterations,
    setMatrixIterations,
    matrixLoading,
    matrixResult,
    runMatrixComparison,
    matrixResultMode,
  } = props;

  return (
    <div className="min-h-88 flex flex-col rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-rose-300">
        Matrix Multiplication
      </h2>
      <p className="mb-3 text-sm text-slate-400">
        Multiply N x N matrices and compare JS against Rust addon output.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-sm text-slate-400">Matrix size (N x N)</label>
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
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400">Iterations</label>
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
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
          />
        </div>
      </div>
      <button
        onClick={() => {
          void runMatrixComparison();
        }}
        disabled={matrixLoading}
        className="mb-4 w-full rounded-lg bg-linear-to-r from-rose-600 to-orange-600 py-3 font-medium text-white transition-all hover:from-rose-500 hover:to-orange-500 disabled:opacity-50"
      >
        {matrixLoading ? "Running..." : "Run Comparison"}
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="rounded-lg border border-amber-800/40 bg-amber-950/40 p-3 text-center">
            <div className="text-sm font-medium text-amber-200">JavaScript</div>
            <div className="text-2xl font-bold text-amber-300">
              {matrixResult.jsTime?.toFixed(1) ?? "-"}
              <span className="text-sm"> ms</span>
            </div>
          </div>
          <div className="rounded-lg border border-orange-800/40 bg-orange-950/40 p-3 text-center">
            <div className="text-sm font-medium text-orange-200">Rust (NAPI)</div>
            <div className="text-2xl font-bold text-orange-300">
              {matrixResult.rustTime?.toFixed(1) ?? "-"}
              <span className="text-sm"> ms</span>
            </div>
          </div>
        </div>
        <div className="min-h-6 text-center font-medium text-emerald-300">
          {getSpeedupLabel(matrixResult.jsTime, matrixResult.rustTime)}
        </div>
        <div className="mb-1 text-center text-xs text-slate-400">
          Result parity: {getParityLabel(matrixResult)}
        </div>
        <div className="text-center text-xs text-slate-400">
          JS compute/transfer: {formatTiming(matrixResult.jsComputeMs)} / {formatTiming(matrixResult.jsTransferMs)}
        </div>
        <div className="text-center text-xs text-slate-400">
          Rust compute/transfer: {formatTiming(matrixResult.rustComputeMs)} / {formatTiming(matrixResult.rustTransferMs)}
        </div>
        <div className="mb-1 text-center text-xs text-slate-400">
          Rust batch: {matrixResult.rustBatchMode ?? "n/a"} ({matrixResult.rustCallbackCalls ?? 0} callback)
        </div>
        {matrixResult.error ? (
          <p className="text-center text-xs text-rose-300">{matrixResult.error}</p>
        ) : null}
        {matrixResultMode === "full" ? (
          <p className="mt-1 text-center text-xs text-slate-500">
            Full mode includes response summarization overhead.
          </p>
        ) : null}
      </div>
    </div>
  );
}
