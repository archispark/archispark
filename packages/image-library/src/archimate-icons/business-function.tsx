import type { SVGProps } from "react"

export function BusinessFunctionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 41" {...props}>
      <path
        d="M 30 0 L 60 8 L 60 40 L 30 32 L 0 40 L 0 8 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(255, 255, 153)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
