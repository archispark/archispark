import type { SVGProps } from "react"

export function PlateauIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 41" {...props}>
      <rect
        x="24"
        y="0"
        width="36"
        height="8"
        style={{ fill: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <rect
        x="12"
        y="16"
        width="36"
        height="8"
        style={{ fill: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <rect
        x="0"
        y="32"
        width="36"
        height="8"
        style={{ fill: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
