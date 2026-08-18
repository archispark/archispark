import type { SVGProps } from "react"

export function BusinessInterfaceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 71 36" {...props}>
      <ellipse
        cx="52.5"
        cy="17.5"
        rx="17.5"
        ry="17.5"
        style={{
          fill: "rgb(255, 255, 153)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <path
        d="M 0 17.5 L 35 17.5"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
