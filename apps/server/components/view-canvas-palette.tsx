"use client"

import { useMemo, useState } from "react"
import type React from "react"
import type { ElementOut } from "@/lib/api"
import { colorFor } from "@/components/view-canvas-colors"
import { HIDDEN_ELEMENT_TYPES } from "@/components/view-canvas-builder"
import { useT } from "@/lib/i18n"

export function ElementPalette({ elements }: { elements: ElementOut[] }) {
  const { t } = useT()
  const [query, setQuery] = useState("")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = (
      q
        ? elements.filter(
            (e) =>
              e.name.toLowerCase().includes(q) ||
              e.type.toLowerCase().includes(q)
          )
        : elements
    ).filter((e) => !HIDDEN_ELEMENT_TYPES.has(e.type))
    const map = new Map<string, ElementOut[]>()
    for (const el of filtered) {
      const list = map.get(el.type) ?? []
      list.push(el)
      map.set(el.type, list)
    }
    return [...map.entries()]
      .map(([type, items]) => ({
        type,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.type.localeCompare(b.type))
  }, [elements, query])

  const onDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    elementId: string
  ) => {
    e.dataTransfer.setData("application/x-archi-element", elementId)
    e.dataTransfer.effectAllowed = "move"
  }

  const toggle = (type: string) =>
    setCollapsed((s) => ({ ...s, [type]: !s[type] }))
  const collapseAll = () =>
    setCollapsed(Object.fromEntries(grouped.map(({ type }) => [type, true])))
  const expandAll = () => setCollapsed({})

  return (
    <div
      style={{
        width: 240,
        borderRight: "1px solid var(--border, #e5e5e5)",
        background: "var(--card, #fff)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: 8,
          borderBottom: "1px solid var(--border, #e5e5e5)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("canvas.search_element")}
          style={{
            width: "100%",
            fontSize: 12,
            padding: "4px 6px",
            border: "1px solid var(--border, #e5e5e5)",
            borderRadius: 4,
            background: "var(--background, #fff)",
            color: "var(--foreground, #0a0a0a)",
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={expandAll}
            title={t("canvas.expand_all")}
            style={{
              flex: 1,
              fontSize: 10,
              padding: "3px 6px",
              border: "1px solid var(--border, #e5e5e5)",
              borderRadius: 3,
              background: "var(--background, #fff)",
              color: "var(--foreground, #0a0a0a)",
              cursor: "pointer",
            }}
          >
            ▾ {t("canvas.expand_all")}
          </button>
          <button
            type="button"
            onClick={collapseAll}
            title={t("canvas.collapse_all")}
            style={{
              flex: 1,
              fontSize: 10,
              padding: "3px 6px",
              border: "1px solid var(--border, #e5e5e5)",
              borderRadius: 3,
              background: "var(--background, #fff)",
              color: "var(--foreground, #0a0a0a)",
              cursor: "pointer",
            }}
          >
            ▸ {t("canvas.collapse_all")}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 4 }}>
        {grouped.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: "var(--muted-foreground, #666)",
              padding: 8,
            }}
          >
            Aucun élément.
          </div>
        ) : (
          grouped.map(({ type, items }) => {
            const { bg, border } = colorFor(type)
            const isCollapsed = collapsed[type] ?? false
            return (
              <div key={type} style={{ marginBottom: 6 }}>
                <button
                  type="button"
                  onClick={() => toggle(type)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--secondary, #f5f5f5)",
                    border: "1px solid var(--border, #e5e5e5)",
                    borderRadius: 3,
                    color: "var(--foreground, #0a0a0a)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>
                    <span
                      style={{
                        display: "inline-block",
                        width: 9,
                        marginRight: 4,
                        textAlign: "center",
                      }}
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    {type}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--muted-foreground, #666)",
                      fontWeight: 400,
                    }}
                  >
                    {items.length}
                  </span>
                </button>
                {isCollapsed ? null : (
                  <div style={{ paddingLeft: 6, marginTop: 2 }}>
                    {items.map((el) => (
                      <div
                        key={el.identifier}
                        draggable
                        onDragStart={(e) => onDragStart(e, el.identifier)}
                        title={`${el.type} — ${el.name}`}
                        style={{
                          padding: "3px 6px",
                          margin: "2px 0",
                          fontSize: 11,
                          cursor: "grab",
                          background: bg,
                          border: `1px solid ${border}`,
                          borderRadius: 3,
                          color: "#111",
                        }}
                      >
                        {el.name || "(sans nom)"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
