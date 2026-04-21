import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  delete process.env.BENCHMARK_MAX_CONCURRENCY;
  vi.resetModules();
});

describe("benchmark route contract", () => {
  it("returns structured payload for js benchmark", async () => {
    const { POST } = await import("../../src/app/api/benchmark/route");

    const request = new Request("http://localhost/api/benchmark", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        algorithm: "prime-count",
        implementation: "js",
        iterations: 2,
        workload: {
          limit: 10_000,
        },
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      ok: boolean;
      runs: Array<{ implementation: string; durationMs: number }>;
      algorithm: string;
      iterations: number;
      rustBatching: string;
    };

    expect(response.status).toBe(200);
    expect(payload.algorithm).toBe("prime-count");
    expect(payload.iterations).toBe(2);
    expect(payload.rustBatching).toBe("native");
    expect(Array.isArray(payload.runs)).toBe(true);
    expect(payload.runs[0]?.implementation).toBe("js");
    expect(typeof payload.runs[0]?.durationMs).toBe("number");
    expect(payload.runs[0]).toMatchObject({
      computeMs: expect.any(Number),
      transferMs: 0,
    });
  });

  it("rejects oversized UTF-8 payload by bytes", async () => {
    const { POST } = await import("../../src/app/api/benchmark/route");

    const oversizedPayload = `{"padding":"${"😄".repeat(2_500)}"}`;

    const request = new Request("http://localhost/api/benchmark", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: oversizedPayload,
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      error?: { code?: string };
    };

    expect(response.status).toBe(413);
    expect(payload.error?.code).toBe("REQUEST_TOO_LARGE");
  });

  it("returns 429 when concurrency limit is reached", async () => {
    process.env.BENCHMARK_MAX_CONCURRENCY = "1";
    vi.resetModules();

    const { POST } = await import("../../src/app/api/benchmark/route");

    const firstRequest = new Request("http://localhost/api/benchmark", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        algorithm: "prime-count",
        implementation: "js",
        iterations: 2,
        workload: {
          limit: 10_000,
        },
      }),
    });

    const secondRequest = new Request("http://localhost/api/benchmark", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        algorithm: "prime-count",
        implementation: "js",
        iterations: 1,
        workload: {
          limit: 100,
        },
      }),
    });

    const firstResponsePromise = POST(firstRequest);
    const secondResponse = await POST(secondRequest);
    const secondPayload = (await secondResponse.json()) as {
      error?: { code?: string };
    };
    const firstResponse = await firstResponsePromise;

    expect(secondResponse.status).toBe(429);
    expect(secondPayload.error?.code).toBe("SERVER_BUSY");
    expect(firstResponse.status).toBe(200);
  });
});
