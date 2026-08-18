import type { SVGProps } from "react"

export function NodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 71 41" {...props}>
      <path
        d="M 0 10 L 17.5 0 L 70 0 L 70 30 L 52.5 40 L 0 40 Z M 0 10 L 52.5 10 L 52.5 40 M 70 0 L 52.5 10"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
