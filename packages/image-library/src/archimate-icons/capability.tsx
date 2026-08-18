import type { SVGProps } from "react"

export function CapabilityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 41 41" {...props}>
      <path
        d="M 40 0 L 40 40 L 0 40 L 0 26.8 L 13.2 26.8 L 13.2 13.2 L 26.8 13.2 L 26.8 0 Z M 26.8 13.2 L 40 13.2 M 13.2 26.8 L 40 26.8 M 13.2 26.8 L 13.2 40 M 26.8 13.2 L 26.8 40"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(245, 222, 170)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
