import type { SVGProps } from "react"

export function PathIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 106 36" {...props}>
      <path
        d="M 23 33 L 3 18 L 23 3 M 83 33 L 103 18 L 83 3"
        strokeWidth="6"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <path
        d="M 3 18 L 103 18"
        strokeWidth="6"
        strokeMiterlimit="10"
        strokeDasharray="18 18"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
