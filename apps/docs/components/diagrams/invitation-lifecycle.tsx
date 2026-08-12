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
    id: "owner",
    position: { x: 0, y: 160 },
    data: { label: "owner\ninvite par e-mail" },
    style: nodeStyle,
  },
  {
    id: "create",
    position: { x: 230, y: 160 },
    data: {
      label:
        "POST .../invitations\ncrée la ligne, stocke le hash SHA-256 du token",
    },
    style: nodeStyle,
  },
  {
    id: "deliver",
    position: { x: 460, y: 160 },
    data: { label: "E-mail envoyé (Mailpit en dev)\net/ou lien copié" },
    style: nodeStyle,
  },
  {
    id: "authenticate",
    position: { x: 690, y: 160 },
    data: {
      label: "L'invité s'authentifie\n(compte existant ou self-registration)",
    },
    style: nodeStyle,
  },
  {
    id: "accept",
    position: { x: 920, y: 160 },
    data: {
      label: "POST .../accept\ncompare-and-swap sur accepted_at/revoked_at",
    },
    style: nodeStyle,
  },
  {
    id: "membership",
    position: { x: 1150, y: 160 },
    data: { label: "Membership créée\n(ON CONFLICT DO NOTHING)" },
    style: nodeStyle,
  },
  {
    id: "resend",
    position: { x: 230, y: 320 },
    data: { label: "Resend : révoque l'ancienne,\német un nouveau token" },
    style: nodeStyle,
  },
]

const edges: Edge[] = [
  { id: "e1", source: "owner", target: "create" },
  { id: "e2", source: "create", target: "deliver" },
  { id: "e3", source: "deliver", target: "authenticate" },
  { id: "e4", source: "authenticate", target: "accept" },
  { id: "e5", source: "accept", target: "membership" },
  {
    id: "e6",
    source: "create",
    target: "resend",
    label: "envoi échoué ou invitation déjà active",
  },
  { id: "e7", source: "resend", target: "deliver" },
]

export function InvitationLifecycleDiagram() {
  return <FlowDiagram nodes={nodes} edges={edges} height={420} />
}
