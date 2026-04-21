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

export interface TimedIterationsOptions {
  iterationTimeoutMs?: number;
}

export type IterationMetricsExtractor<T> = (
  result: T,
  elapsedMs: number,
) => IterationTimingMetrics;

export class BenchmarkTimeoutError extends Error {
  constructor(
    readonly timeoutMs: number,
    readonly scope: "total" | "iteration" = "total",
  ) {
    super(
      scope === "iteration"
        ? `Benchmark iteration exceeded timeout budget of ${timeoutMs}ms.`
        : `Benchmark exceeded total timeout budget of ${timeoutMs}ms.`,
    );
    this.name = "BenchmarkTimeoutError";
  }
}

export async function runTimedIterations<T>(
  callback: () => Promise<T> | T,
  iterations: number,
  timeoutMs: number,
  metricsExtractor?: IterationMetricsExtractor<T>,
  options?: TimedIterationsOptions,
): Promise<TimedIterationsResult<T>> {
  const samples: number[] = [];
  const computeSamples: number[] = [];
  const transferSamples: number[] = [];
  let lastResult: T | undefined;
  const globalStart = performance.now();
  const iterationTimeoutMs = options?.iterationTimeoutMs ?? timeoutMs;

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      lastResult = await Promise.race<T>([
        Promise.resolve().then(callback),
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new BenchmarkTimeoutError(iterationTimeoutMs, "iteration"));
          }, iterationTimeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    }

    const elapsed = performance.now() - startedAt;

    // Sync CPU-heavy callbacks can block the event loop and bypass Promise.race timer firing.
    if (elapsed > iterationTimeoutMs) {
      throw new BenchmarkTimeoutError(iterationTimeoutMs, "iteration");
    }

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
      throw new BenchmarkTimeoutError(timeoutMs, "total");
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
