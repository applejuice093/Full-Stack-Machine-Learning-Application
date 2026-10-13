import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app/app.js";

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
        datasetId: "abc",
        target: "price",
        features: ["rooms"],
        task: "clustering",
        modelId: "linear_regression",
      });

    expect(response.status).toBe(400);
    expect(response.body.detail).toEqual(expect.any(String));
  });
});

describe("POST /datasets/store validation", () => {
  it("rejects empty headers", async () => {
    const response = await request(app)
      .post("/datasets/store")
      .send({ filename: "x.csv", headers: [], rows: [["1"]] });

    expect(response.status).toBe(400);
  });
});
