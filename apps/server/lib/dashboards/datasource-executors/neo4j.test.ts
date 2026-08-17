import { describe, expect, it } from "vitest"
import { assertOrganizationScoped, assertPanelQuerySafe, assertReadOnly, boundedCypher } from "./neo4j"

describe("boundedCypher", () => {
  it("wraps the query and enforces a server-side row cap", () => {
    expect(boundedCypher("MATCH (n) RETURN n")).toContain("LIMIT 500")
  })
})

describe("assertReadOnly", () => {
  it("accepts a single read statement", () => {
    expect(() => assertReadOnly("MATCH (n) RETURN n")).not.toThrow()
    expect(() => assertReadOnly("OPTIONAL MATCH (n) RETURN n")).not.toThrow()
  })

  it("rejects multiple statements", () => {
    expect(() => assertReadOnly("MATCH (n); RETURN n")).toThrow(/lecture unique/)
  })

  it("rejects a write statement", () => {
    expect(() => assertReadOnly("CREATE (n) RETURN n")).toThrow(/lecture unique/)
  })
})

describe("assertOrganizationScoped", () => {
  it("accepts a query referencing $organizationId", () => {
    expect(() =>
      assertOrganizationScoped("MATCH (e:Element {organizationId: $organizationId}) RETURN e")
    ).not.toThrow()
  })

  it("rejects a query that doesn't reference $organizationId — the multi-tenant scoping contract", () => {
    expect(() => assertOrganizationScoped("MATCH (e:Element) RETURN e")).toThrow(/organizationId/)
  })
})

describe("assertPanelQuerySafe", () => {
  it("combines both checks", () => {
    expect(() =>
      assertPanelQuerySafe("MATCH (e:Element {organizationId: $organizationId}) RETURN e")
    ).not.toThrow()
    expect(() => assertPanelQuerySafe("MATCH (e:Element) RETURN e")).toThrow(/organizationId/)
    expect(() => assertPanelQuerySafe("CREATE (n) RETURN n")).toThrow(/lecture unique/)
  })
})
