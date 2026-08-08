import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/archimate/registry", () => ({
  getWorkspaces: vi.fn(async () => [
    { id: "1", name: "Default", active: true },
  ]),
  activateWorkspace: vi.fn(async () => ({
    id: "2",
    name: "Other",
    active: true,
  })),
}))

const { registerWorkspaceTools } = await import("./workspace-tools")
const { createFakeMcpServer, TEST_AUTH } = await import("./test-helper")
const registry = await import("@/lib/archimate/registry")

function setup() {
  const { mcpServer, toolHandlers } = createFakeMcpServer()
  registerWorkspaceTools(mcpServer, TEST_AUTH)
  return toolHandlers
}

describe("workspace tools", () => {
  it("list_workspaces lists available workspaces", async () => {
    const tools = setup()
    const result = (await tools.get("list_workspaces")!({})) as {
      content: [{ text: string }]
    }
    expect(vi.mocked(registry.getWorkspaces)).toHaveBeenCalledWith(
      TEST_AUTH.user
    )
    expect(result.content[0].text).toContain("Default")
  })

  it("activate_workspace activates by id", async () => {
    const tools = setup()
    const result = (await tools.get("activate_workspace")!({
      workspace_id: "2",
    })) as { content: [{ text: string }] }
    expect(vi.mocked(registry.activateWorkspace)).toHaveBeenCalledWith(
      TEST_AUTH.user,
      "2"
    )
    expect(result.content[0].text).toContain("Other")
  })
})
