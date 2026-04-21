import { NextResponse } from "next/server";

import { runBenchmarkImplementations } from "@/server/benchmark/execution";
import {
  createRequestId,
  parseBenchmarkRouteRequest,
} from "@/server/benchmark/request-parser";
import { buildBenchmarkResponse } from "@/server/benchmark/response-mapper";
import { getNativeAddonHealth } from "@/server/native-addon-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_CONCURRENT_BENCHMARKS = 2;
const RETRY_AFTER_SECONDS = "1";

let activeBenchmarkRequests = 0;

function getMaxConcurrentBenchmarks(): number {
  const raw = process.env.BENCHMARK_MAX_CONCURRENCY;
  if (typeof raw !== "string") {
    return DEFAULT_MAX_CONCURRENT_BENCHMARKS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_CONCURRENT_BENCHMARKS;
  }

  return parsed;
}

const MAX_CONCURRENT_BENCHMARKS = getMaxConcurrentBenchmarks();

function tryAcquireBenchmarkSlot(): boolean {
  if (activeBenchmarkRequests >= MAX_CONCURRENT_BENCHMARKS) {
    return false;
  }

  activeBenchmarkRequests += 1;
  return true;
}

function releaseBenchmarkSlot(): void {
  activeBenchmarkRequests = Math.max(activeBenchmarkRequests - 1, 0);
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = createRequestId();

  if (!tryAcquireBenchmarkSlot()) {
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: {
          code: "SERVER_BUSY",
          message: "Benchmark server is busy. Retry shortly.",
        },
      },
      {
        status: 429,
        headers: {
          "retry-after": RETRY_AFTER_SECONDS,
        },
      },
    );
  }

  try {
    const parsed = await parseBenchmarkRouteRequest(request);
    if (!parsed.ok) {
      const { error } = parsed;
      return NextResponse.json(
        {
          ok: false,
          requestId,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status },
      );
    }

    const { benchmarkRequest, timeoutMs, rustBatching, matrixResultMode, preparedInput } =
      parsed.value;

    const addon = await getNativeAddonHealth();
    const runs = await runBenchmarkImplementations({
      benchmarkRequest,
      timeoutMs,
      rustBatching,
      matrixResultMode,
      preparedInput,
    });

    const builtResponse = buildBenchmarkResponse({
      requestId,
      benchmarkRequest,
      rustBatching,
      matrixResultMode,
      runs,
      addon,
    });

    return NextResponse.json(builtResponse.body, { status: builtResponse.statusCode });
  } finally {
    releaseBenchmarkSlot();
  }
}
