import { describe, expect, it } from "vitest";

import {
  BenchmarkTimeoutError,
  runTimedIterations,
} from "@/lib/benchmark-runner";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("benchmark-runner", () => {
  it("fails with iteration timeout for slow callbacks", async () => {
    await expect(
      runTimedIterations(
        async () => {
          await sleep(40);
          return 1;
        },
        1,
        200,
        undefined,
        {
          iterationTimeoutMs: 10,
        },
      ),
    ).rejects.toMatchObject({
      name: "BenchmarkTimeoutError",
      scope: "iteration",
    } satisfies Partial<BenchmarkTimeoutError>);
  });

  it("fails with total timeout when cumulative duration exceeds budget", async () => {
    await expect(
      runTimedIterations(
        async () => {
          await sleep(35);
          return 1;
        },
        3,
        60,
        undefined,
        {
          iterationTimeoutMs: 200,
        },
      ),
    ).rejects.toMatchObject({
      name: "BenchmarkTimeoutError",
      scope: "total",
    } satisfies Partial<BenchmarkTimeoutError>);
  });
});
