import type { SVGProps } from "react"

export function GapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 56 41" {...props}>
      <ellipse
        cx="27.5"
        cy="20"
        rx="19.25"
        ry="18"
        style={{
          fill: "rgb(255, 224, 224)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <path
        d="M 0 14.6 L 55 14.6 M 0 25.4 L 55 25.4"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
