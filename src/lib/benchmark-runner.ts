export interface TimedIterationsResult<T> {
  result: T;
  durationMs: number;
  samples: number[];
}

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
): Promise<TimedIterationsResult<T>> {
  const samples: number[] = [];
  let lastResult: T | undefined;
  const globalStart = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    lastResult = await callback();
    const elapsed = performance.now() - startedAt;

    samples.push(elapsed);

    const totalElapsed = performance.now() - globalStart;
    if (totalElapsed > timeoutMs) {
      throw new BenchmarkTimeoutError(timeoutMs);
    }
  }

  if (lastResult === undefined) {
    throw new Error("Benchmark iteration did not produce any result.");
  }

  const total = samples.reduce((acc, sample) => acc + sample, 0);

  return {
    result: lastResult,
    durationMs: Number((total / samples.length).toFixed(3)),
    samples,
  };
}
