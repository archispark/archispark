import type { SVGProps } from "react"

export function BusinessRoleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 36" {...props}>
      <path
        d="M 48 0 L 12 0 C 5.37 0 0 7.84 0 17.5 C 0 27.16 5.37 35 12 35 L 48 35"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(255, 255, 153)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <ellipse
        cx="48"
        cy="17.5"
        rx="12"
        ry="17.5"
        style={{
          fill: "rgb(255, 255, 153)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
