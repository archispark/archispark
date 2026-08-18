import type { SVGProps } from "react"

export function BusinessActorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 28 51" {...props}>
      <ellipse
        cx="13.25"
        cy="7.5"
        rx="7.949999999999999"
        ry="7.5"
        style={{
          fill: "rgb(255, 255, 153)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <path
        d="M 13.25 15 L 13.25 37.5 M 0 22.5 L 26.5 22.5 M 0 50 L 13.25 37.5 L 26.5 50"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
