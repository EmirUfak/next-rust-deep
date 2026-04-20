import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
});
