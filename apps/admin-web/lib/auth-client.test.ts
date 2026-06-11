import { describe, it, expect } from "vitest";
import { authClient, signIn, signOut, signUp, useSession, getSession } from "./auth-client";

describe("auth-client", () => {
  it("exports an authClient instance", () => {
    expect(authClient).toBeDefined();
    expect(authClient.organization).toBeDefined();
  });

  it("exports signIn, signOut, signUp helpers", () => {
    expect(signIn).toBeDefined();
    expect(typeof signOut).toBe("function");
    expect(signUp).toBeDefined();
  });

  it("exports useSession and getSession helpers", () => {
    expect(typeof useSession).toBe("function");
    expect(typeof getSession).toBe("function");
  });

  it("exposes the organization plugin client methods", () => {
    expect(authClient.organization).toBeDefined();
    expect(typeof authClient.organization.create).toBe("function");
    expect(typeof authClient.organization.update).toBe("function");
  });
});
