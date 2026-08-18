import type { SVGProps } from "react"

export function ApplicationComponentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 49 41" {...props}>
      <rect
        x="12"
        y="0"
        width="36"
        height="40"
        style={{
          fill: "rgb(153, 255, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <rect
        x="0"
        y="10"
        width="24"
        height="6"
        style={{
          fill: "rgb(153, 255, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <rect
        x="0"
        y="24"
        width="24"
        height="6"
        style={{
          fill: "rgb(153, 255, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
