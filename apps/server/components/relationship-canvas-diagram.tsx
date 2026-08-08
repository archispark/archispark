"use client"

import Link from "next/link"
import { getLayer, LAYER_HEX_COLORS } from "@/lib/archimate-helpers"

function ElementBox({
  id,
  name,
  type,
}: {
  id: string
  name: string
  type: string
}) {
  const layer = getLayer(type)
  const color = LAYER_HEX_COLORS[layer] ?? "#64748b"
  return (
    <Link
      href={`/elements/${encodeURIComponent(id)}`}
      className="block no-underline transition-transform hover:scale-[1.02]"
    >
      <div
        style={{
          width: 160,
          border: `1.5px solid ${color}`,
          borderRadius: 8,
          background: `${color}18`,
          padding: "10px 14px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color,
            fontWeight: 700,
            letterSpacing: 0.4,
            marginBottom: 4,
          }}
        >
          {type}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#1e293b",
            lineHeight: 1.3,
          }}
        >
          {name || "—"}
        </div>
      </div>
    </Link>
  )
}

/** Simple source → relationship → target diagram for the relationship detail page's canvas tab. */
export function RelationshipCanvas({
  relType,
  relName,
  isOk,
  srcId,
  srcName,
  srcType,
  tgtId,
  tgtName,
  tgtType,
}: {
  relType: string
  relName: string | null
  isOk: boolean
  srcId: string
  srcName: string
  srcType: string
  tgtId: string
  tgtName: string
  tgtType: string
}) {
  const arrowColor = isOk ? "#10b981" : "#dc2626"
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex items-center gap-4">
        <ElementBox id={srcId} name={srcName} type={srcType} />
        <div className="flex flex-col items-center gap-1.5 select-none">
          <svg width="120" height="20" style={{ overflow: "visible" }}>
            <line
              x1="0"
              y1="10"
              x2="110"
              y2="10"
              stroke={arrowColor}
              strokeWidth="1.5"
            />
            <polygon points="110,6 120,10 110,14" fill={arrowColor} />
          </svg>
          <div className="flex flex-col items-center gap-0.5">
            <span
              className="text-[11px] font-semibold"
              style={{ color: arrowColor }}
            >
              {relType}
            </span>
            {relName && (
              <span className="text-[10px] text-muted-foreground italic">
                {relName}
              </span>
            )}
          </div>
        </div>
        <ElementBox id={tgtId} name={tgtName} type={tgtType} />
      </div>
    </div>
  )
}
