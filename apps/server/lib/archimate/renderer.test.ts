import { describe, it, expect } from "vitest"
import { renderViewToSvg } from "./renderer"
import type { ArchiModel, ArchiNode, ArchiView } from "@workspace/db"

function elementNode(uuid: string, type: string): ArchiNode {
  return {
    uuid: `node-${uuid}`,
    name: null,
    ref: { uuid, name: "Element", type, desc: null, props: {} },
    x: 0,
    y: 0,
    w: 120,
    h: 60,
    fill_color: null,
    line_color: null,
    font_name: null,
    font_size: null,
    font_color: null,
    line_width: null,
    archi_type: 0, // forces getShapeKind() -> "rect"
    nodes: [],
  }
}

function emptyModel(): ArchiModel {
  return {
    uuid: "id-model",
    name: "Model",
    desc: null,
    version: null,
    elements: [],
    relationships: [],
    propertyDefinitions: [],
    views: [],
  }
}

describe("renderViewToSvg", () => {
  it("draws the vector type icon when no image is resolved for the element", () => {
    const view: ArchiView = {
      uuid: "id-view",
      name: "View",
      desc: null,
      primary_viewpoint: null,
      nodes: [elementNode("el-1", "Goal")],
      conns: [],
    }
    const svg = renderViewToSvg(view, emptyModel())
    expect(svg).not.toContain("<image")
  })

  it("draws an <image> instead of the vector icon when the element resolves to an image", () => {
    const view: ArchiView = {
      uuid: "id-view",
      name: "View",
      desc: null,
      primary_viewpoint: null,
      nodes: [elementNode("el-1", "Goal")],
      conns: [],
    }
    const elementImages = new Map([
      ["el-1", "https://blob.example.test/icon.png"],
    ])
    const svg = renderViewToSvg(view, emptyModel(), elementImages)
    expect(svg).toContain(
      '<image href="https://blob.example.test/icon.png"'
    )
  })

  it("does not draw an image for an element with no resolved entry", () => {
    const view: ArchiView = {
      uuid: "id-view",
      name: "View",
      desc: null,
      primary_viewpoint: null,
      nodes: [elementNode("el-1", "Goal")],
      conns: [],
    }
    const elementImages = new Map([
      ["el-2", "https://blob.example.test/other.png"],
    ])
    const svg = renderViewToSvg(view, emptyModel(), elementImages)
    expect(svg).not.toContain("<image")
  })
})
