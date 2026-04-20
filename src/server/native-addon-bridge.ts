import "server-only";
import { createRequire } from "node:module";

interface TimedScalarRecord {
  result: number;
  computeMs?: number;
  compute_ms?: number;
}

interface MatrixSummaryTimedRecord {
  length: number;
  first: number;
  checksum: number;
  computeMs?: number;
  compute_ms?: number;
}

interface NativeAddonApi {
  countPrimes(limit: number): number;
  countPrimesTimed(limit: number): TimedScalarRecord;
  countPrimesBatchTimed(limit: number, iterations: number): TimedScalarRecord;
  matrixMultiplyParallel(
    left: Float64Array,
    right: Float64Array,
    size: number,
  ): number[] | Float64Array;
  matrixMultiplySummaryTimed(
    left: Float64Array,
    right: Float64Array,
    size: number,
  ): MatrixSummaryTimedRecord;
  matrixMultiplySummaryBatchTimed(
    left: Float64Array,
    right: Float64Array,
    size: number,
    iterations: number,
  ): MatrixSummaryTimedRecord;
  dotProductParallel(left: Float64Array, right: Float64Array): number;
  dotProductTimed(left: Float64Array, right: Float64Array): TimedScalarRecord;
  dotProductBatchTimed(
    left: Float64Array,
    right: Float64Array,
    iterations: number,
  ): TimedScalarRecord;
}

export interface NativeTimedScalarResult {
  value: number;
  computeMs: number;
}

export interface NativeMatrixSummaryResult {
  length: number;
  first: number;
  checksum: number;
  computeMs: number;
}

export class NativeAddonUnavailableError extends Error {
  constructor(
    message: string,
    readonly causeError?: unknown,
  ) {
    super(message);
    this.name = "NativeAddonUnavailableError";
  }
}

let addonCache: NativeAddonApi | null = null;
let addonLoadError: string | null = null;
const runtimeRequire = createRequire(import.meta.url);

function readComputeMs(record: {
  computeMs?: number;
  compute_ms?: number;
}): number {
  const candidate =
    typeof record.computeMs === "number"
      ? record.computeMs
      : typeof record.compute_ms === "number"
        ? record.compute_ms
        : NaN;

  if (!Number.isFinite(candidate)) {
    throw new NativeAddonUnavailableError(
      "Native addon returned invalid compute timing metadata.",
    );
  }

  return candidate;
}

function toTimedScalarResult(record: TimedScalarRecord): NativeTimedScalarResult {
  return {
    value: record.result,
    computeMs: readComputeMs(record),
  };
}

function toMatrixSummaryResult(
  record: MatrixSummaryTimedRecord,
): NativeMatrixSummaryResult {
  return {
    length: record.length,
    first: record.first,
    checksum: record.checksum,
    computeMs: readComputeMs(record),
  };
}

function normalizeMatrixOutput(output: number[] | Float64Array): number[] {
  return Array.isArray(output) ? output : Array.from(output);
}

function ensureNodeRuntime(): void {
  if (
    typeof process === "undefined" ||
    typeof process.versions?.node !== "string"
  ) {
    throw new NativeAddonUnavailableError(
      "Native addon requires Node.js runtime. Edge runtime is not supported.",
    );
  }
}

function asApi(candidate: unknown): NativeAddonApi {
  if (!candidate || typeof candidate !== "object") {
    throw new NativeAddonUnavailableError("Native addon exports are missing.");
  }

  const addon = candidate as Partial<NativeAddonApi>;

  if (
    typeof addon.countPrimes !== "function" ||
    typeof addon.countPrimesTimed !== "function" ||
    typeof addon.countPrimesBatchTimed !== "function" ||
    typeof addon.matrixMultiplyParallel !== "function" ||
    typeof addon.matrixMultiplySummaryTimed !== "function" ||
    typeof addon.matrixMultiplySummaryBatchTimed !== "function" ||
    typeof addon.dotProductParallel !== "function" ||
    typeof addon.dotProductTimed !== "function" ||
    typeof addon.dotProductBatchTimed !== "function"
  ) {
    throw new NativeAddonUnavailableError(
      "Native addon does not expose required functions.",
    );
  }

  return addon as NativeAddonApi;
}

async function loadAddon(): Promise<NativeAddonApi> {
  ensureNodeRuntime();

  if (addonCache) {
    return addonCache;
  }

  try {
    const loaded = runtimeRequire("@next-rust-deep/native-addon") as unknown;
    addonCache = asApi(loaded);
    addonLoadError = null;

    return addonCache;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    addonLoadError =
      "Native addon could not be loaded. Run 'bun run build:rust' before starting the app." +
      ` Root cause: ${reason}`;
    throw new NativeAddonUnavailableError(addonLoadError, error);
  }
}

export async function getNativeAddonHealth(): Promise<{
  available: boolean;
  error?: string;
}> {
  try {
    await loadAddon();
    return { available: true };
  } catch (error) {
    if (error instanceof NativeAddonUnavailableError) {
      return { available: false, error: error.message };
    }

    return {
      available: false,
      error: addonLoadError ?? "Native addon health check failed.",
    };
  }
}

export async function runRustPrimeCount(limit: number): Promise<number> {
  const addon = await loadAddon();
  return addon.countPrimes(limit);
}

export async function runRustPrimeCountTimed(
  limit: number,
): Promise<NativeTimedScalarResult> {
  const addon = await loadAddon();
  return toTimedScalarResult(addon.countPrimesTimed(limit));
}

export async function runRustPrimeCountBatchTimed(
  limit: number,
  iterations: number,
): Promise<NativeTimedScalarResult> {
  const addon = await loadAddon();
  return toTimedScalarResult(addon.countPrimesBatchTimed(limit, iterations));
}

export async function runRustMatrixMultiply(
  left: Float64Array,
  right: Float64Array,
  size: number,
): Promise<number[]> {
  const addon = await loadAddon();
  return normalizeMatrixOutput(addon.matrixMultiplyParallel(left, right, size));
}

export async function runRustMatrixSummaryTimed(
  left: Float64Array,
  right: Float64Array,
  size: number,
): Promise<NativeMatrixSummaryResult> {
  const addon = await loadAddon();
  return toMatrixSummaryResult(addon.matrixMultiplySummaryTimed(left, right, size));
}

export async function runRustMatrixSummaryBatchTimed(
  left: Float64Array,
  right: Float64Array,
  size: number,
  iterations: number,
): Promise<NativeMatrixSummaryResult> {
  const addon = await loadAddon();
  return toMatrixSummaryResult(
    addon.matrixMultiplySummaryBatchTimed(left, right, size, iterations),
  );
}

export async function runRustDotProduct(
  left: Float64Array,
  right: Float64Array,
): Promise<number> {
  const addon = await loadAddon();
  return addon.dotProductParallel(left, right);
}

export async function runRustDotProductTimed(
  left: Float64Array,
  right: Float64Array,
): Promise<NativeTimedScalarResult> {
  const addon = await loadAddon();
  return toTimedScalarResult(addon.dotProductTimed(left, right));
}

export async function runRustDotProductBatchTimed(
  left: Float64Array,
  right: Float64Array,
  iterations: number,
): Promise<NativeTimedScalarResult> {
  const addon = await loadAddon();
  return toTimedScalarResult(addon.dotProductBatchTimed(left, right, iterations));
}
