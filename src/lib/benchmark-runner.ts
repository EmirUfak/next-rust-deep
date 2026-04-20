export interface TimedIterationsResult<T> {
  result: T;
  durationMs: number;
  samples: number[];
  computeMs: number | null;
  transferMs: number | null;
}

export interface IterationTimingMetrics {
  computeMs?: number;
  transferMs?: number;
}

export type IterationMetricsExtractor<T> = (
  result: T,
  elapsedMs: number,
) => IterationTimingMetrics;

export class BenchmarkTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Benchmark exceeded timeout budget of ${timeoutMs}ms.`);
    this.name = "BenchmarkTimeoutError";
  }
}

export async function runTimedIterations<T>(
  callback: () => Promise<T> | T,
  iterations: number,
  timeoutMs: number,
  metricsExtractor?: IterationMetricsExtractor<T>,
): Promise<TimedIterationsResult<T>> {
  const samples: number[] = [];
  const computeSamples: number[] = [];
  const transferSamples: number[] = [];
  let lastResult: T | undefined;
  const globalStart = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    lastResult = await callback();
    const elapsed = performance.now() - startedAt;

    samples.push(elapsed);

    if (metricsExtractor) {
      const metrics = metricsExtractor(lastResult, elapsed);

      if (typeof metrics.computeMs === "number") {
        computeSamples.push(metrics.computeMs);
      }

      if (typeof metrics.transferMs === "number") {
        transferSamples.push(metrics.transferMs);
      }
    }

    const totalElapsed = performance.now() - globalStart;
    if (totalElapsed > timeoutMs) {
      throw new BenchmarkTimeoutError(timeoutMs);
    }
  }

  if (lastResult === undefined) {
    throw new Error("Benchmark iteration did not produce any result.");
  }

  const total = samples.reduce((acc, sample) => acc + sample, 0);
  const computeTotal = computeSamples.reduce((acc, sample) => acc + sample, 0);
  const transferTotal = transferSamples.reduce((acc, sample) => acc + sample, 0);

  return {
    result: lastResult,
    durationMs: Number((total / samples.length).toFixed(3)),
    samples,
    computeMs:
      computeSamples.length > 0
        ? Number((computeTotal / computeSamples.length).toFixed(3))
        : null,
    transferMs:
      transferSamples.length > 0
        ? Number((transferTotal / transferSamples.length).toFixed(3))
        : null,
  };
}
