import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app/app.js";

describe("error handler", () => {
  it("explains malformed JSON bodies with a 400", async () => {
    const response = await request(app)
      .post("/train")
      .set("Content-Type", "application/json")
      .send('{"datasetId": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ detail: "The request body is not valid JSON." });
  });

  it("rejects JSON bodies over the 4 MB limit with a 413", async () => {
    const big = JSON.stringify({ filename: "x.csv", headers: ["a"], rows: [["x".repeat(4 * 1024 * 1024)]] });

    const response = await request(app)
      .post("/datasets/store")
      .set("Content-Type", "application/json")
      .send(big);

    expect(response.status).toBe(413);
    expect(response.body.detail).toMatch(/larger than 4 MB/);
  });
});
