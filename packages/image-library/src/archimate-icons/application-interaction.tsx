import type { SVGProps } from "react"

export function ApplicationInteractionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 41 41" {...props}>
      <path
        d="M 22 0 C 31.94 0 40 8.95 40 20 C 40 31.05 31.94 40 22 40 Z M 18 0 C 8.06 0 0 8.95 0 20 C 0 31.05 8.06 40 18 40 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(153, 255, 255)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
