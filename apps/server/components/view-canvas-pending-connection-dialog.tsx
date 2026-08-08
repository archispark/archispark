"use client"

import { allowedRelationships } from "@/lib/archimate-rules"

export interface PendingConnection {
  source: string
  target: string
  sourceElement: string
  targetElement: string
  sourceType?: string
  targetType?: string
}

export function PendingConnectionDialog({
  pendingConnection,
  onCancel,
  onConfirmType,
}: {
  pendingConnection: PendingConnection
  onCancel: () => void
  onConfirmType: (type: string) => void
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card, #fff)",
          color: "var(--card-foreground, #0a0a0a)",
          border: "1px solid var(--border, #e5e5e5)",
          borderRadius: 8,
          padding: 16,
          minWidth: 280,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          Type ArchiMate
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--muted-foreground, #666)",
            marginBottom: 10,
          }}
        >
          {pendingConnection.sourceType ?? "?"} →{" "}
          {pendingConnection.targetType ?? "?"}
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
        >
          {allowedRelationships(
            pendingConnection.sourceType,
            pendingConnection.targetType
          ).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onConfirmType(t)}
              style={{
                padding: "6px 10px",
                fontSize: 12,
                background: "var(--secondary, #f5f5f5)",
                color: "var(--secondary-foreground, #0a0a0a)",
                border: "1px solid var(--border, #e5e5e5)",
                borderRadius: 4,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12, textAlign: "right" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              background: "transparent",
              color: "var(--muted-foreground, #666)",
              border: "1px solid var(--border, #e5e5e5)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
