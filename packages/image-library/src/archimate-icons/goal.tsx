import type { SVGProps } from "react"

export function GoalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 41 41" {...props}>
      <ellipse
        cx="20"
        cy="20"
        rx="20"
        ry="20"
        style={{
          fill: "rgb(204, 204, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <ellipse
        cx="20"
        cy="20"
        rx="14"
        ry="14"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <ellipse
        cx="20"
        cy="20"
        rx="8"
        ry="8"
        style={{
          fill: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
