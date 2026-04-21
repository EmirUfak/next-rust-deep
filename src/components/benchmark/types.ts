import { type RustBatchingMode } from "@/lib/benchmark-types";

export interface CaseResult {
  jsTime: number | null;
  rustTime: number | null;
  jsComputeMs: number | null;
  rustComputeMs: number | null;
  jsTransferMs: number | null;
  rustTransferMs: number | null;
  jsSummary: string | null;
  rustSummary: string | null;
  speedup: number | null;
  rustBatchMode: RustBatchingMode | null;
  rustCallbackCalls: number | null;
  error: string | null;
  requestId: string | null;
}

export const emptyCaseResult: CaseResult = {
  jsTime: null,
  rustTime: null,
  jsComputeMs: null,
  rustComputeMs: null,
  jsTransferMs: null,
  rustTransferMs: null,
  jsSummary: null,
  rustSummary: null,
  speedup: null,
  rustBatchMode: null,
  rustCallbackCalls: null,
  error: null,
  requestId: null,
};
