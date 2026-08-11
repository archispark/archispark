"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { Maximize2, Minimize2 } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export function useReactFlowFullscreen() {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!fullscreen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.addEventListener("keydown", onKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [fullscreen])

  return {
    fullscreen,
    toggleFullscreen: () => setFullscreen((current) => !current),
  }
}

export function ReactFlowFullscreenButton({
  fullscreen,
  onToggle,
}: {
  fullscreen: boolean
  onToggle: () => void
}) {
  const label = fullscreen
    ? "Quitter le plein écran"
    : "Agrandir en plein écran"

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      className="nodrag nopan flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
    >
      {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  )
}

/**
 * Wraps a canvas so it can expand into a fixed, full-viewport overlay.
 * `fullscreenClassName` overrides base classes (e.g. to drop rounding) since
 * it is merged last.
 */
export function FullscreenContainer({
  fullscreen,
  className,
  fullscreenClassName,
  style,
  children,
}: {
  fullscreen: boolean
  className?: string
  fullscreenClassName?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      style={style}
      className={cn(
        className,
        fullscreen && "fixed inset-0 z-[60] bg-background p-4",
        fullscreen && fullscreenClassName
      )}
    >
      {children}
    </div>
  )
}
