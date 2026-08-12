"use client"

import type { CSSProperties } from "react"
import type { Edge, Node } from "@xyflow/react"
import { FlowDiagram } from "@/components/flow-diagram"

const nodeStyle: CSSProperties = {
  width: 190,
  fontSize: 12,
  textAlign: "center",
  whiteSpace: "pre-line",
}

const nodes: Node[] = [
  {
    id: "login",
    position: { x: 0, y: 140 },
    data: { label: "/login" },
    style: nodeStyle,
  },
  {
    id: "auth-login",
    position: { x: 230, y: 140 },
    data: { label: "GET /api/auth/login\nPKCE + state → cookies" },
    style: nodeStyle,
  },
  {
    id: "keycloak",
    position: { x: 460, y: 140 },
    data: { label: "Keycloak\n/protocol/openid-connect/auth" },
    style: nodeStyle,
  },
  {
    id: "callback",
    position: { x: 690, y: 140 },
    data: {
      label: "GET /api/auth/callback\néchange le code, pose les cookies",
    },
    style: nodeStyle,
  },
  {
    id: "authenticated",
    position: { x: 920, y: 140 },
    data: { label: "Requête authentifiée\n(UI, API, MCP)" },
    style: nodeStyle,
  },
  {
    id: "proxy",
    position: { x: 920, y: 320 },
    data: { label: "proxy.ts\ntoken expiré ?" },
    style: nodeStyle,
  },
  {
    id: "refresh",
    position: { x: 690, y: 320 },
    data: { label: "POST /api/auth/refresh" },
    style: nodeStyle,
  },
  {
    id: "logout",
    position: { x: 460, y: 320 },
    data: { label: "GET /api/auth/logout" },
    style: nodeStyle,
  },
]

const edges: Edge[] = [
  { id: "e1", source: "login", target: "auth-login" },
  { id: "e2", source: "auth-login", target: "keycloak" },
  { id: "e3", source: "keycloak", target: "callback" },
  { id: "e4", source: "callback", target: "authenticated" },
  {
    id: "e5",
    source: "authenticated",
    target: "proxy",
    label: "chaque navigation",
  },
  { id: "e6", source: "proxy", target: "authenticated", label: "valide" },
  { id: "e7", source: "proxy", target: "refresh", label: "expiré" },
  {
    id: "e8",
    source: "refresh",
    target: "authenticated",
    label: "204 + nouveaux cookies",
  },
  {
    id: "e9",
    source: "refresh",
    target: "auth-login",
    label: "échec → /login",
  },
  { id: "e10", source: "authenticated", target: "logout" },
  { id: "e11", source: "logout", target: "login" },
]

export function OidcLoginFlowDiagram() {
  return <FlowDiagram nodes={nodes} edges={edges} height={420} />
}
