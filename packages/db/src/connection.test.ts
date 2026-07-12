import { describe, it, expect } from "vitest";
import { isLocalConnectionString } from "./connection.js";

describe("isLocalConnectionString", () => {
  it("returns true for localhost", () => {
    expect(isLocalConnectionString("postgresql://user:pass@localhost:5432/db")).toBe(true);
  });

  it("returns true for the docker-compose postgres hostname", () => {
    expect(isLocalConnectionString("postgresql://user:pass@postgres:5432/db")).toBe(true);
  });

  it("returns true for an explicit sslmode=disable", () => {
    expect(isLocalConnectionString("postgresql://user:pass@some-host:5432/db?sslmode=disable")).toBe(true);
  });

  it("returns false for a remote managed Postgres URL", () => {
    expect(isLocalConnectionString("postgresql://user:pass@ep-fake.us-east-2.aws.neon.tech/db?sslmode=require")).toBe(false);
  });
});
