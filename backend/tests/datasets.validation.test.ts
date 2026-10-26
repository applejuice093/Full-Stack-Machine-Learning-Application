import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app/app.js";

const ID = "0123456789abcdef0123456789abcdef";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /train validation", () => {
  it("rejects a missing body with 400", async () => {
    const response = await request(app).post("/train").send({});

    expect(response.status).toBe(400);
    expect(response.body.detail).toEqual(expect.any(String));
  });

  it("rejects an invalid task", async () => {
    const response = await request(app)
      .post("/train")
      .send({
        datasetId: ID,
        target: "price",
        features: ["rooms"],
        task: "clustering",
        modelId: "linear_regression",
      });

    expect(response.status).toBe(400);
    expect(response.body.detail).toMatch(/^task:/);
  });

  it("rejects a dataset id that did not come from the ML service", async () => {
    const response = await request(app)
      .post("/train")
      .send({
        datasetId: "../secrets",
        target: "price",
        features: ["rooms"],
        task: "regression",
        modelId: "linear_regression",
      });

    expect(response.status).toBe(400);
    expect(response.body.detail).toMatch(/^datasetId:/);
  });

  it("forwards a valid request with defaults filled in", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .post("/train")
      .send({
        datasetId: ID,
        target: "price",
        features: ["rooms"],
        task: "regression",
        modelId: "linear_regression",
      });

    expect(response.status).toBe(200);
    const sent = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(sent).toMatchObject({ testSize: 0.2, seed: 42, scale: true, dropDuplicates: true });
  });
});

describe("POST /predict validation", () => {
  it("rejects an empty set of input values", async () => {
    const response = await request(app).post("/predict").send({ runId: ID, values: {} });

    expect(response.status).toBe(400);
    expect(response.body.detail).toMatch(/at least one input/);
  });
});

describe("POST /datasets/store validation", () => {
  it("rejects empty headers", async () => {
    const response = await request(app)
      .post("/datasets/store")
      .send({ filename: "x.csv", headers: [], rows: [["1"]] });

    expect(response.status).toBe(400);
  });

  it("rejects rows whose width does not match the headers", async () => {
    const response = await request(app)
      .post("/datasets/store")
      .send({ filename: "x.csv", headers: ["a", "b"], rows: [["1", "2"], ["3"]] });

    expect(response.status).toBe(400);
    expect(response.body.detail).toMatch(/^rows\.1:/);
  });

  it("rejects duplicate column names", async () => {
    const response = await request(app)
      .post("/datasets/store")
      .send({ filename: "x.csv", headers: ["a", "a"], rows: [["1", "2"]] });

    expect(response.status).toBe(400);
    expect(response.body.detail).toMatch(/unique/);
  });
});
