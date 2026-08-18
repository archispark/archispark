import type { SVGProps } from "react"

export function TechnologyCollaborationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 36" {...props}>
      <ellipse
        cx="18"
        cy="17.5"
        rx="18"
        ry="17.5"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <ellipse
        cx="42"
        cy="17.5"
        rx="18"
        ry="17.5"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
