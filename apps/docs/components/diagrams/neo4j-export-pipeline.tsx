"use client"

import type { CSSProperties } from "react"
import type { Edge, Node } from "@xyflow/react"
import { FlowDiagram } from "@/components/flow-diagram"

const nodeStyle: CSSProperties = {
  width: 200,
  fontSize: 12,
  textAlign: "center",
  whiteSpace: "pre-line",
}

const nodes: Node[] = [
  {
    id: "postgres",
    position: { x: 0, y: 100 },
    data: { label: "Postgres\n(packages/db)" },
    style: nodeStyle,
  },
  {
    id: "mapping",
    position: { x: 250, y: 100 },
    data: {
      label: "packages/db-neo4j\nArchiModel → Cypher (layer stampé)",
    },
    style: nodeStyle,
  },
  {
    id: "neo4j",
    position: { x: 500, y: 100 },
    data: { label: "Neo4j\nnœuds/relations stampés organizationId" },
    style: nodeStyle,
  },
  {
    id: "dashboards",
    position: { x: 750, y: 100 },
    data: {
      label:
        "Dashboards & /explore\n(panel-execution.ts, datasource-executors.ts)",
    },
    style: nodeStyle,
  },
]

const edges: Edge[] = [
  {
    id: "e1",
    source: "postgres",
    target: "mapping",
    label: "POST /api/export/neo4j",
  },
  { id: "e2", source: "mapping", target: "neo4j", label: "import versionné" },
  {
    id: "e3",
    source: "neo4j",
    target: "dashboards",
    label: "Cypher paramétré, $organizationId injecté",
  },
]

export function Neo4jExportPipelineDiagram() {
  return <FlowDiagram nodes={nodes} edges={edges} height={260} />
}
