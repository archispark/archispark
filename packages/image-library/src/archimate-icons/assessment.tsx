import type { SVGProps } from "react"

export function AssessmentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 41 41" {...props}>
      <ellipse
        cx="24"
        cy="16"
        rx="16"
        ry="16"
        style={{
          fill: "rgb(204, 204, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <path
        d="M 0 40 L 12.8 27.2"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
