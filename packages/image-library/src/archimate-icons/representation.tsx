import type { SVGProps } from "react"

export function RepresentationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 71 41" {...props}>
      <path
        d="M 0 0 L 70 0 L 70 34 C 65.39 31.31 59.08 29.8 52.5 29.8 C 45.92 29.8 39.61 31.31 35 34 C 30.39 36.69 24.08 38.2 17.5 38.2 C 10.92 38.2 4.61 36.69 0 34 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(255, 255, 153)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <path
        d="M 0 15 L 70 15"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
