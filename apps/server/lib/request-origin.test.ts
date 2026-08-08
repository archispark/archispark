import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getRequestOrigin } from "./request-origin";

describe("getRequestOrigin", () => {
  it("derives the origin from the Host header", () => {
    const req = new NextRequest("http://0.0.0.0:8000/api/auth/login", {
      headers: { host: "localhost:8000" },
    });
    expect(getRequestOrigin(req)).toBe("http://localhost:8000");
  });

  it("falls back to nextUrl.origin when there is no Host header", () => {
    const req = new NextRequest("http://localhost:8000/api/auth/login");
    req.headers.delete("host");
    expect(getRequestOrigin(req)).toBe("http://localhost:8000");
  });
});
