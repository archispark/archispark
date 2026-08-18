import type { SVGProps } from "react"

export function TechnologyEventIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 36" {...props}>
      <path
        d="M 42.5 0 C 52.16 0 60 7.84 60 17.5 C 60 27.16 52.16 35 42.5 35 L 0 35 L 17.5 17.5 L 0 0 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
