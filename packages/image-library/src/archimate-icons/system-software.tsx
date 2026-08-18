import type { SVGProps } from "react"

export function SystemSoftwareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 41 41" {...props}>
      <ellipse
        cx="26"
        cy="14"
        rx="14"
        ry="14"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <ellipse
        cx="19.6"
        cy="20.4"
        rx="19.6"
        ry="19.6"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
