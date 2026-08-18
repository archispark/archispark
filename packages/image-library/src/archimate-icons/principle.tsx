import type { SVGProps } from "react"

export function PrincipleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 42 42" {...props}>
      <path
        d="M 3 3 C 14.88 0.63 27.12 0.63 39 3 C 41.37 14.88 41.37 27.12 39 39 C 27.12 41.37 14.88 41.37 3 39 C 0.63 27.12 0.63 14.88 3 3 Z"
        strokeWidth="2"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(204, 204, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <path
        d="M 19 29 L 17.8 7 L 24.2 7 L 23 29 Z"
        style={{ fill: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <rect
        x="19"
        y="31"
        width="4"
        height="4"
        style={{ fill: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
