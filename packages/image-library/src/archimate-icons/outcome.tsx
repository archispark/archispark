import type { SVGProps } from "react"

export function OutcomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 62 62" {...props}>
      <ellipse
        cx="25"
        cy="37"
        rx="24"
        ry="24"
        strokeWidth="2"
        style={{
          fill: "rgb(204, 204, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <ellipse
        cx="25"
        cy="37"
        rx="15"
        ry="15"
        strokeWidth="2"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <ellipse
        cx="25"
        cy="37"
        rx="6"
        ry="6"
        strokeWidth="2"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <path
        d="M 25 37 L 55 7 M 26.2 25 L 25 37 L 37 35.8 M 49 1 L 46 16 L 61 13"
        strokeWidth="6"
        strokeLinecap="round"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
