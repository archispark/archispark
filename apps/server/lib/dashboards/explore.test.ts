import { describe, expect, it } from "vitest"
import { ExploreQueryError, wrapExploreQuery } from "./explore"

describe("wrapExploreQuery", () => {
  it("wraps the query and enforces a server-side row cap", () => {
    expect(wrapExploreQuery("MATCH (n) RETURN n")).toContain("LIMIT 500")
  })

  it("rejects an empty query", () => {
    expect(() => wrapExploreQuery("   ")).toThrow(ExploreQueryError)
  })

  it("rejects EXPLAIN/PROFILE typed by the user (the server already wraps with EXPLAIN itself)", () => {
    expect(() => wrapExploreQuery("EXPLAIN MATCH (n) RETURN n")).toThrow(/EXPLAIN et PROFILE/)
    expect(() => wrapExploreQuery("PROFILE MATCH (n) RETURN n")).toThrow(/EXPLAIN et PROFILE/)
  })

  it("rejects a query longer than the configured limit", () => {
    expect(() => wrapExploreQuery("MATCH (n) RETURN n //" + "x".repeat(20_000))).toThrow(/dépasse/)
  })
})
