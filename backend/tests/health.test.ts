import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app/app.js";

describe("GET /health", () => {
  it("returns the API status with version and uptime", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("backend");
    expect(typeof response.body.version).toBe("string");
    expect(typeof response.body.uptimeSeconds).toBe("number");
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe("unknown routes", () => {
  it("returns JSON 404", async () => {
    const response = await request(app).get("/no-such-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ detail: "Not found." });
  });
});
