import type { SVGProps } from "react"

export function FacilityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 41" {...props}>
      <path
        d="M 0 40 L 0 0 L 7.8 0 L 7.8 28 L 25.2 22 L 25.2 28 L 42.6 22 L 42.6 28 L 60 22 L 60 40 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
