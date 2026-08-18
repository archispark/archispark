import type { SVGProps } from "react"

export function ValueStreamIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 71 36" {...props}>
      <path
        d="M 0 0.5 L 52.5 0.5 L 70 18 L 52.5 35.5 L 0 35.5 L 17.5 18 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(245, 222, 170)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
