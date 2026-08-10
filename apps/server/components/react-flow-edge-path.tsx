"use client"

import { createContext } from "react"

export type EdgePathType = "smoothstep" | "bezier" | "step" | "straight"

export const EdgeTypeContext = createContext<EdgePathType>("smoothstep")

export function getStepPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}): [string, number, number] {
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  return [
    `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`,
    midX,
    midY,
  ]
}
