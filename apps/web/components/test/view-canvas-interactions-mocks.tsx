/**
 * Shared mocks + fixtures for the view-canvas-interactions-*.test.tsx files.
 *
 * Exposes a richer @xyflow/react mock than components/test/view-canvas-mocks.tsx:
 * it captures the event handlers passed to <ReactFlow> so tests can invoke them
 * directly without a real React Flow canvas.
 */
import { vi } from "vitest"
import type React from "react"
import type { NodeOut, ConnectionOut, ElementOut } from "@/lib/api"

// ---------------------------------------------------------------------------
// Hoisted shared state — accessible in vi.mock factory and in test files
// ---------------------------------------------------------------------------

const shared = vi.hoisted(() => {
  let capturedOnConnect:
    | ((p: { source: string | null; target: string | null }) => void)
    | undefined
  let capturedOnNodeDragStop:
    | ((
        _e: unknown,
        node: {
          id: string
          position: { x: number; y: number }
          parentId?: string
        }
      ) => void)
    | undefined
  let capturedOnNodesDelete: ((deleted: { id: string }[]) => void) | undefined
  let capturedOnEdgesDelete: ((deleted: { id: string }[]) => void) | undefined
  let capturedOnNodeDoubleClick:
    | ((
        _e: unknown,
        node: { id: string; data: Record<string, unknown> }
      ) => void)
    | undefined
  let capturedOnEdgeDoubleClick:
    | ((_e: unknown, edge: { id: string; label: unknown }) => void)
    | undefined
  let capturedOnDrop: ((e: React.DragEvent<HTMLDivElement>) => void) | undefined
  let capturedOnDragOver:
    | ((e: React.DragEvent<HTMLDivElement>) => void)
    | undefined
  let capturedOnReconnect:
    | ((
        oldEdge: {
          id: string
          source: string
          target: string
          sourceHandle: string | null
          targetHandle: string | null
        },
        newConn: {
          source: string | null
          target: string | null
          sourceHandle: string | null
          targetHandle: string | null
        }
      ) => void)
    | undefined
  let edgeSelectedOverride = false

  return {
    get onConnect() {
      return capturedOnConnect
    },
    set onConnect(v) {
      capturedOnConnect = v
    },
    get onNodeDragStop() {
      return capturedOnNodeDragStop
    },
    set onNodeDragStop(v) {
      capturedOnNodeDragStop = v
    },
    get onNodesDelete() {
      return capturedOnNodesDelete
    },
    set onNodesDelete(v) {
      capturedOnNodesDelete = v
    },
    get onEdgesDelete() {
      return capturedOnEdgesDelete
    },
    set onEdgesDelete(v) {
      capturedOnEdgesDelete = v
    },
    get onNodeDoubleClick() {
      return capturedOnNodeDoubleClick
    },
    set onNodeDoubleClick(v) {
      capturedOnNodeDoubleClick = v
    },
    get onEdgeDoubleClick() {
      return capturedOnEdgeDoubleClick
    },
    set onEdgeDoubleClick(v) {
      capturedOnEdgeDoubleClick = v
    },
    get onDrop() {
      return capturedOnDrop
    },
    set onDrop(v) {
      capturedOnDrop = v
    },
    get onDragOver() {
      return capturedOnDragOver
    },
    set onDragOver(v) {
      capturedOnDragOver = v
    },
    get onReconnect() {
      return capturedOnReconnect
    },
    set onReconnect(v) {
      capturedOnReconnect = v
    },
    get edgeSelectedOverride() {
      return edgeSelectedOverride
    },
    set edgeSelectedOverride(v) {
      edgeSelectedOverride = v
    },
  }
})

export { shared }

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

export const dialogMock = {
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open?: boolean
  }) => (open ? <div role="dialog">{children}</div> : <>{children}</>),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogClose: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}

export const buttonMock = {
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    [key: string]: unknown
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}

export const apiMock = {
  createRelationship: vi
    .fn()
    .mockResolvedValue({ identifier: "rel-new", type: "Association" }),
  createViewConnection: vi
    .fn()
    .mockResolvedValue({ identifier: "conn-new", source: "n1", target: "n2" }),
  createViewNode: vi.fn().mockResolvedValue({
    identifier: "n-new",
    element_ref: "e1",
    x: 60,
    y: 60,
    w: 120,
    h: 60,
    name: null,
    children: [],
  }),
  deleteViewConnection: vi.fn().mockResolvedValue(undefined),
  deleteViewNode: vi.fn().mockResolvedValue(undefined),
  updateViewConnection: vi.fn().mockResolvedValue(undefined),
  updateViewNode: vi.fn().mockResolvedValue(undefined),
}

export const htmlToImageMock = {
  toPng: vi.fn(() => Promise.resolve("data:image/png;base64,abc")),
  toSvg: vi.fn(() => Promise.resolve("data:image/svg+xml;base64,abc")),
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

export const makeNode = (
  id: string,
  overrides: Partial<NodeOut> = {}
): NodeOut => ({
  identifier: id,
  name: id,
  element_ref: null,
  x: 10,
  y: 20,
  w: 120,
  h: 60,
  children: [],
  ...overrides,
})

export const makeEdge = (
  id: string,
  src: string,
  tgt: string,
  relRef?: string
): ConnectionOut => ({
  identifier: id,
  relationship_ref: relRef ?? null,
  source: src,
  target: tgt,
  name: null,
})

export const makeElement = (
  id: string,
  name: string,
  type: string
): ElementOut => ({
  identifier: id,
  name,
  type,
  documentation: null,
  properties: [],
})
