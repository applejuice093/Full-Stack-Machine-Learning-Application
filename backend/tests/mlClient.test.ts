import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app/app.js";

const RUN_ID = "0123456789abcdef0123456789abcdef";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ML service proxy", () => {
  it("passes JSON responses through with the upstream status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: "Unknown trained model." }), { status: 400 })),
    );

    const response = await request(app).get(`/visualize/evaluation/${RUN_ID}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ detail: "Unknown trained model." });
  });

  it("turns a non-JSON upstream reply into a 502", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })));

    const response = await request(app).get(`/visualize/evaluation/${RUN_ID}`);

    expect(response.status).toBe(502);
    expect(response.body.detail).toMatch(/unexpected response/);
  });

  it("returns 503 when the ML service cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const response = await request(app).get(`/visualize/evaluation/${RUN_ID}`);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ detail: "The ML service is not running." });
  });

  it("returns 504 when the ML service times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }),
    );

    const response = await request(app).get(`/visualize/evaluation/${RUN_ID}`);

    expect(response.status).toBe(504);
    expect(response.body.detail).toMatch(/too long/);
  });
});
