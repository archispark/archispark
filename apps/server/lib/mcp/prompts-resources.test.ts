import { describe, it, expect } from "vitest"
import { registerPromptsAndResources } from "./prompts-resources"
import { createFakeMcpServer } from "./tools/test-helper"

function setup() {
  const { mcpServer, promptHandlers, resourceHandlers } = createFakeMcpServer()
  registerPromptsAndResources(mcpServer)
  return { promptHandlers, resourceHandlers }
}

describe("MCP prompts", () => {
  it("archimate-modeling-guide returns a user message with the guide text", async () => {
    const { promptHandlers } = setup()
    const result = (await promptHandlers.get("archimate-modeling-guide")!(
      {}
    )) as {
      messages: { role: string; content: { type: string; text: string } }[]
    }
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]!.role).toBe("user")
    expect(result.messages[0]!.content.type).toBe("text")
    expect(result.messages[0]!.content.text).toContain("ArchiMate")
  })

  it("create-viewpoint-view references the requested viewpoint", async () => {
    const { promptHandlers } = setup()
    const result = (await promptHandlers.get("create-viewpoint-view")!({
      viewpoint: "Layered",
    })) as { messages: { content: { text: string } }[] }
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]!.content.text).toContain("Layered")
    expect(result.messages[0]!.content.text).toContain("create_view")
  })
})

describe("MCP resources", () => {
  it("archimate-layers returns JSON content", async () => {
    const { resourceHandlers } = setup()
    const result = (await resourceHandlers.get("archimate-layers")!()) as {
      contents: { uri: string; mimeType: string; text: string }[]
    }
    expect(result.contents).toHaveLength(1)
    expect(result.contents[0]!.uri).toBe("archimate://layers")
    expect(result.contents[0]!.mimeType).toBe("application/json")
    expect(JSON.parse(result.contents[0]!.text)).toHaveProperty("Business")
  })

  it("archimate-relationships returns JSON content", async () => {
    const { resourceHandlers } = setup()
    const result = (await resourceHandlers.get(
      "archimate-relationships"
    )!()) as { contents: { uri: string; mimeType: string; text: string }[] }
    expect(result.contents).toHaveLength(1)
    expect(result.contents[0]!.uri).toBe("archimate://relationships")
    expect(result.contents[0]!.mimeType).toBe("application/json")
    expect(JSON.parse(result.contents[0]!.text)).toHaveProperty("Association")
  })
})
