import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app/app.js";

describe("GET /health", () => {
  it("returns the API status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "backend" });
  });
});
