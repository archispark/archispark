import type { SVGProps } from "react"

export function BusinessProcessIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 31" {...props}>
      <path
        d="M 0 9 L 36 9 L 36 0 L 60 15 L 36 30 L 36 21 L 0 21 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(255, 255, 153)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
