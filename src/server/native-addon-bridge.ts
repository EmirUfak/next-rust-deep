import "server-only";
import { createRequire } from "node:module";

interface NativeAddonApi {
  countPrimes(limit: number): number;
  matrixMultiplyParallel(
    left: number[],
    right: number[],
    size: number,
  ): number[];
  dotProductParallel(left: number[], right: number[]): number;
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
    typeof addon.matrixMultiplyParallel !== "function" ||
    typeof addon.dotProductParallel !== "function"
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

export async function runRustMatrixMultiply(
  left: number[],
  right: number[],
  size: number,
): Promise<number[]> {
  const addon = await loadAddon();
  return addon.matrixMultiplyParallel(left, right, size);
}

export async function runRustDotProduct(
  left: number[],
  right: number[],
): Promise<number> {
  const addon = await loadAddon();
  return addon.dotProductParallel(left, right);
}
