import { parseBenchmarkRequest } from "@/lib/validation";
import { WORKLOAD_LIMITS } from "@/lib/benchmark-types";

import { prepareInput, resolveMatrixResultMode } from "./workloads";
import type { ParsedBenchmarkRouteRequest } from "./types";

const BODY_TEXT_ENCODER = new TextEncoder();

export interface ParsedRequestFailure {
  status: number;
  code: string;
  message: string;
}

export type ParsedBenchmarkRouteResult =
  | {
      ok: true;
      value: ParsedBenchmarkRouteRequest;
    }
  | {
      ok: false;
      error: ParsedRequestFailure;
    };

export function createRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export async function parseBenchmarkRouteRequest(
  request: Request,
): Promise<ParsedBenchmarkRouteResult> {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_BODY",
        message: "Request body could not be read.",
      },
    };
  }

  const rawBodyBytes = BODY_TEXT_ENCODER.encode(rawBody).byteLength;
  if (rawBodyBytes > WORKLOAD_LIMITS.bodyBytes) {
    return {
      ok: false,
      error: {
        status: 413,
        code: "REQUEST_TOO_LARGE",
        message: `Request body exceeds ${WORKLOAD_LIMITS.bodyBytes} bytes limit.`,
      },
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return {
      ok: false,
      error: {
        status: 400,
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    };
  }

  const parsed = parseBenchmarkRequest(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      error: {
        status: 400,
        code: "VALIDATION_FAILED",
        message: firstIssue?.message ?? "Benchmark request validation failed.",
      },
    };
  }

  const benchmarkRequest = parsed.data;
  const timeoutMs = benchmarkRequest.timeoutMs ?? WORKLOAD_LIMITS.timeoutMs.default;
  const rustBatching = benchmarkRequest.rustBatching ?? "native";
  const matrixResultMode = resolveMatrixResultMode(benchmarkRequest);
  const preparedInput = prepareInput(benchmarkRequest);

  return {
    ok: true,
    value: {
      benchmarkRequest,
      timeoutMs,
      rustBatching,
      matrixResultMode,
      preparedInput,
    },
  };
}
