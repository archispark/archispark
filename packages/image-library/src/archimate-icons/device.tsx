import type { SVGProps } from "react"

export function DeviceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 71 36" {...props}>
      <rect
        x="0"
        y="0"
        width="70"
        height="30.8"
        rx="7"
        ry="3.5"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <path
        d="M 7 30.8 L 0 35 L 70 35 L 63 30.8"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
