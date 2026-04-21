import {
  type AddonHealth,
  type MatrixResultMode,
  type RustBatchingMode,
  WORKLOAD_LIMITS,
} from "@/lib/benchmark-types";

import { clamp, shortRequestId, parseIntSafe } from "./utils";

interface HealthSettingsCardProps {
  addonHealth: AddonHealth;
  timeoutMs: number;
  setTimeoutMs: (value: number) => void;
  rustBatching: RustBatchingMode;
  setRustBatching: (value: RustBatchingMode) => void;
  matrixResultMode: MatrixResultMode;
  setMatrixResultMode: (value: MatrixResultMode) => void;
  primeRequestId: string | null;
  matrixRequestId: string | null;
  dotRequestId: string | null;
}

export function HealthSettingsCard(props: HealthSettingsCardProps) {
  const {
    addonHealth,
    timeoutMs,
    setTimeoutMs,
    rustBatching,
    setRustBatching,
    matrixResultMode,
    setMatrixResultMode,
    primeRequestId,
    matrixRequestId,
    dotRequestId,
  } = props;

  const panelClass = addonHealth.available
    ? "border-emerald-800/40 bg-emerald-950/30"
    : "border-rose-800/40 bg-rose-950/30";

  const panelTitleClass = addonHealth.available
    ? "text-emerald-300"
    : "text-rose-300";

  const panelTextClass = addonHealth.available
    ? "text-emerald-200/90"
    : "text-rose-200/90";

  return (
    <div className="min-h-88 flex flex-col rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-teal-300">
        Native Addon Health
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        Verifies whether the Rust native binary can be loaded by the Node runtime.
      </p>
      <p className="mb-4 text-xs text-slate-400">
        If this card is unavailable, Rust benchmarks fail and only JS side can run.
      </p>

      <label className="mb-2 text-sm text-slate-400">Timeout (ms)</label>
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
        className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
      />

      <label className="mb-2 text-sm text-slate-400">Rust batching mode</label>
      <select
        value={rustBatching}
        onChange={(event) =>
          setRustBatching(event.target.value as RustBatchingMode)
        }
        className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
      >
        <option value="native">native</option>
        <option value="none">none</option>
      </select>

      <label className="mb-2 text-sm text-slate-400">Matrix result mode</label>
      <select
        value={matrixResultMode}
        onChange={(event) =>
          setMatrixResultMode(event.target.value as MatrixResultMode)
        }
        className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
      >
        <option value="summary">summary</option>
        <option value="full">full</option>
      </select>

      <div className="flex-1 flex items-center justify-center">
        <div className={`w-full rounded-lg border p-6 text-center ${panelClass}`}>
          <div className={`mb-1 font-medium ${panelTitleClass}`}>
            {addonHealth.available ? "Addon Available" : "Addon Unavailable"}
          </div>
          <div className={`mb-2 text-xs ${panelTextClass}`}>
            Endpoint: /api/health/addon
          </div>
          <div className={`mb-2 break-all text-xs ${panelTextClass}`} title={primeRequestId ?? undefined}>
            Prime request: {shortRequestId(primeRequestId)}
          </div>
          <div className={`mb-2 break-all text-xs ${panelTextClass}`} title={matrixRequestId ?? undefined}>
            Matrix request: {shortRequestId(matrixRequestId)}
          </div>
          <div className={`mb-2 break-all text-xs ${panelTextClass}`} title={dotRequestId ?? undefined}>
            Dot request: {shortRequestId(dotRequestId)}
          </div>
          {addonHealth.error ? (
            <div className="mt-3 text-xs text-rose-200">{addonHealth.error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
