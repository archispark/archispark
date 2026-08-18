import type { SVGProps } from "react"

export function ValueIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 71 36" {...props}>
      <ellipse
        cx="35"
        cy="17.5"
        rx="35"
        ry="17.5"
        style={{
          fill: "rgb(204, 204, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
