import type { SVGProps } from "react"

export function RequirementIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 71 36" {...props}>
      <path
        d="M 17.5 0 L 70 0 L 52.5 35 L 0 35 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(204, 204, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
