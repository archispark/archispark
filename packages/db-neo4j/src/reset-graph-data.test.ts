import { describe, it, expect, vi } from "vitest"
import { resetGraphData } from "./reset-graph-data.js"

vi.mock("./connection.js", () => ({ getDriver: vi.fn() }))

describe("resetGraphData", () => {
  it("runs the DETACH DELETE query and returns the deleted node count", async () => {
    const executeQuery = vi.fn().mockResolvedValue({
      records: [{ get: (key: string) => (key === "deleted" ? 42 : undefined) }],
    })
    const { getDriver } = await import("./connection.js")
    vi.mocked(getDriver).mockReturnValue({ executeQuery } as never)

    const result = await resetGraphData()

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE NOT n:SchemaMigration")
    )
    expect(result).toEqual({ deleted: 42 })
  })
})
