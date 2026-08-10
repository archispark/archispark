import { describe, expect, it, vi } from "vitest"

const mockDriver = vi.hoisted(() => ({ session: undefined as unknown }))

vi.mock("@workspace/db-neo4j", () => ({
  getDriver: () => ({ session: () => mockDriver.session }),
}))

import { ExploreQueryError, runExploreQuery, wrapExploreQuery } from "./explore"

describe("wrapExploreQuery", () => {
  it("wraps the query and enforces a server-side row cap", () => {
    expect(wrapExploreQuery("MATCH (n) RETURN n")).toContain("LIMIT 500")
  })

  it("rejects an empty query", () => {
    expect(() => wrapExploreQuery("   ")).toThrow(ExploreQueryError)
  })

  it("rejects EXPLAIN/PROFILE typed by the user (the server already wraps with EXPLAIN itself)", () => {
    expect(() => wrapExploreQuery("EXPLAIN MATCH (n) RETURN n")).toThrow(
      /EXPLAIN et PROFILE/
    )
    expect(() => wrapExploreQuery("PROFILE MATCH (n) RETURN n")).toThrow(
      /EXPLAIN et PROFILE/
    )
  })

  it("rejects a query longer than the configured limit", () => {
    expect(() =>
      wrapExploreQuery("MATCH (n) RETURN n //" + "x".repeat(20_000))
    ).toThrow(/dépasse/)
  })
})

describe("runExploreQuery", () => {
  it("hydrates graph results sequentially in its Neo4j session", async () => {
    let hasOngoingWork = false
    const queries: string[] = []
    mockDriver.session = {
      run: async (query: string) => {
        if (hasOngoingWork) throw new Error("session with ongoing work")
        hasOngoingWork = true
        await new Promise((resolve) => setTimeout(resolve, 0))
        hasOngoingWork = false
        queries.push(query)

        if (query.startsWith("EXPLAIN")) return { summary: { queryType: "r" } }
        if (query.startsWith("CALL")) {
          return {
            records: [{ keys: ["nodeIds"], get: () => ["element-1"] }],
          }
        }
        return { records: [] }
      },
      close: async () => undefined,
    }

    const result = await runExploreQuery(
      "MATCH (element:Element) RETURN collect(element.id) AS nodeIds",
      {},
      1
    )

    expect(result.rows).toEqual([{ nodeIds: ["element-1"] }])
    expect(queries).toHaveLength(4)
  })
})
