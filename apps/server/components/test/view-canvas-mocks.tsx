/**
 * Shared vi.mock() factories + test data builders for view-canvas.test.tsx
 * and view-canvas-palette.test.tsx — imported via an async vi.mock factory
 * (`() => import("./test/view-canvas-mocks").then((m) => m.xyzMock)`) so the
 * mock definitions aren't duplicated across the split test files.
 */
import { vi } from "vitest"
import { render } from "@testing-library/react"
import { I18nProvider } from "@/lib/i18n"
import type { NodeOut, ConnectionOut, ElementOut } from "@/lib/api"

export const dialogMock = {
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
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

type NodeRenderer = React.ComponentType<{
  id: string
  data: Record<string, unknown>
  selected: boolean
}>
type EdgeRenderer = React.ComponentType<{
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: string
  targetPosition: string
  data: Record<string, unknown>
  label: unknown
  selected: boolean
}>

export const reactFlowMock = {
  ReactFlow: ({
    nodes,
    edges,
    nodeTypes = {},
    edgeTypes = {},
    children,
  }: {
    nodes: Array<{
      id: string
      type?: string
      data: Record<string, unknown>
      selected?: boolean
      position?: { x: number; y: number }
      parentId?: string
    }>
    edges: Array<{
      id: string
      type?: string
      data: Record<string, unknown>
      label?: unknown
    }>
    nodeTypes?: Record<string, NodeRenderer>
    edgeTypes?: Record<string, EdgeRenderer>
    children?: React.ReactNode
  }) => (
    <div data-testid="reactflow">
      <span data-testid="node-count">{nodes.length}</span>
      <span data-testid="edge-count">{edges.length}</span>
      {children}
      {nodes.map((n) => {
        const Comp = n.type ? nodeTypes[n.type] : undefined
        return Comp ? (
          <div
            key={n.id}
            data-testid={`node-${n.id}`}
            data-x={n.position?.x}
            data-y={n.position?.y}
            data-parent={n.parentId ?? ""}
          >
            <Comp id={n.id} data={n.data} selected={n.selected ?? false} />
          </div>
        ) : null
      })}
      {edges.map((e) => {
        const Comp = e.type ? edgeTypes[e.type] : undefined
        return Comp ? (
          <Comp
            key={e.id}
            id={e.id}
            sourceX={0}
            sourceY={0}
            targetX={100}
            targetY={100}
            sourcePosition="bottom"
            targetPosition="top"
            data={e.data ?? {}}
            label={e.label}
            selected={false}
          />
        ) : null
      })}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  NodeResizer: () => null,
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  BaseEdge: () => null,
  EdgeLabelRenderer: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  Panel: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  getSmoothStepPath: () => ["M0,0 L1,1", 0, 0],
  getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  getViewportForBounds: () => ({ x: 0, y: 0, zoom: 1 }),
  reconnectEdge: (_old: unknown, _new: unknown, eds: unknown[]) => eds,
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useReactFlow: () => ({
    getNodes: () => [],
    setEdges: vi.fn(),
    setNodes: vi.fn(),
    screenToFlowPosition: (p: { x: number; y: number }) => p,
  }),
  ReactFlowProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}

export const htmlToImageMock = {
  toPng: vi.fn(() => Promise.resolve("")),
  toSvg: vi.fn(() => Promise.resolve("")),
}

export function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

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
