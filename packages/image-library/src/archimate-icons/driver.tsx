import type { SVGProps } from "react"

export function DriverIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 41 41" {...props}>
      <path
        d="M 0 20 L 40 20 M 20 0 L 20 40 M 5.8 5.8 L 34.2 34.2 M 5.8 34.2 L 34.2 5.8"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <ellipse
        cx="20"
        cy="20"
        rx="6"
        ry="6"
        style={{
          fill: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <ellipse
        cx="20"
        cy="20"
        rx="16"
        ry="16"
        strokeWidth="2"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
