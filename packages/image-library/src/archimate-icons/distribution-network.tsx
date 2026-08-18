import type { SVGProps } from "react"

export function DistributionNetworkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 74 34" {...props}>
      <path
        d="M 9 9.5 L 65 9.5 L 72 17 L 65 24.5 L 9 24.5 L 2 17"
        strokeWidth="4"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <path
        d="M 16 2 L 2 17 L 16 32 M 58 2 L 72 17 L 58 32"
        strokeWidth="4"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
