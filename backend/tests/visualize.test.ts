import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app/app.js";

const ID = "0123456789abcdef0123456789abcdef";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubOk() {
  const fetchMock = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({ images: {} }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GET /visualize/evaluation/:runId", () => {
  it("rejects ids that are not ML run ids without calling the ML service", async () => {
    const fetchMock = stubOk();

    for (const bad of ["abc", "..%2F..%2Fhealth", `${ID}x`]) {
      const response = await request(app).get(`/visualize/evaluation/${bad}`);
      expect(response.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a valid run id", async () => {
    const fetchMock = stubOk();

    const response = await request(app).get(`/visualize/evaluation/${ID}`);

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(new RegExp(`/visualize/evaluation/${ID}$`));
  });
});

describe("POST /visualize/dataset", () => {
  it("rejects a body without a dataset id", async () => {
    const fetchMock = stubOk();

    const response = await request(app).post("/visualize/dataset").send({});

    expect(response.status).toBe(400);
    expect(response.body.detail).toMatch(/datasetId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only the validated dataset id", async () => {
    const fetchMock = stubOk();

    const response = await request(app)
      .post("/visualize/dataset")
      .send({ datasetId: ID, extra: "ignored" });

    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ datasetId: ID });
  });
});
