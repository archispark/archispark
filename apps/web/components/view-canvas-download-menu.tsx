"use client"

import { useEffect, useRef, useState } from "react"
import {
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react"
import { toPng, toSvg } from "html-to-image"

const IMAGE_WIDTH = 1024
const IMAGE_HEIGHT = 768

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a")
  a.setAttribute("download", filename)
  a.setAttribute("href", dataUrl)
  a.click()
}

const DOWNLOAD_FORMATS: ReadonlyArray<{
  format: "png" | "svg"
  label: string
}> = [
  { format: "png", label: "PNG" },
  { format: "svg", label: "SVG" },
]

export function DownloadMenu() {
  const { getNodes } = useReactFlow()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      // `Node` in this module is React Flow's node type; use the DOM Node here.
      const target = e.target as globalThis.Node | null
      if (ref.current && target && !ref.current.contains(target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const download = (format: "png" | "svg") => {
    setOpen(false)
    const nodesBounds = getNodesBounds(getNodes())
    const viewport = getViewportForBounds(
      nodesBounds,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
      0.5,
      2,
      0
    )
    const el = document.querySelector(
      ".react-flow__viewport"
    ) as HTMLElement | null
    if (!el) return
    const options = {
      backgroundColor: "#ffffff",
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      style: {
        width: `${IMAGE_WIDTH}px`,
        height: `${IMAGE_HEIGHT}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    }
    const toImage = format === "svg" ? toSvg : toPng
    toImage(el, options).then((dataUrl) =>
      downloadDataUrl(dataUrl, `view.${format}`)
    )
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          background: "#fff",
          border: "1px solid #b1b1b7",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Télécharger <span aria-hidden>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "#fff",
            border: "1px solid #b1b1b7",
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            minWidth: 120,
            zIndex: 10,
          }}
        >
          {DOWNLOAD_FORMATS.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => download(format)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "5px 10px",
                fontSize: 12,
                background: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
