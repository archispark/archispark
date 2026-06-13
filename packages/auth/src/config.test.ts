import { describe, it, expect } from "vitest";
import { getKeycloakConfig } from "./config.js";

describe("getKeycloakConfig", () => {
  it("throws when KEYCLOAK_URL is unset", () => {
    process.env["KEYCLOAK_URL"] = "";
    process.env["KEYCLOAK_REALM"] = "archispark";
    expect(() => getKeycloakConfig()).toThrow("KEYCLOAK_URL");
  });

  it("throws when KEYCLOAK_REALM is unset", () => {
    process.env["KEYCLOAK_URL"] = "http://localhost:8080";
    process.env["KEYCLOAK_REALM"] = "";
    expect(() => getKeycloakConfig()).toThrow("KEYCLOAK_REALM");
  });

  it("returns the config when both vars are set", () => {
    process.env["KEYCLOAK_URL"] = "http://localhost:8080";
    process.env["KEYCLOAK_REALM"] = "archispark";
    expect(getKeycloakConfig()).toEqual({ url: "http://localhost:8080", realm: "archispark" });
  });
});
