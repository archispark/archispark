import type { SVGProps } from "react"

export function DeliverableIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 36" {...props}>
      <path
        d="M 0 0 L 60 0 L 60 29.75 C 56.05 27.4 50.64 26.07 45 26.07 C 39.36 26.07 33.95 27.4 30 29.75 C 26.05 32.1 20.64 33.43 15 33.43 C 9.36 33.43 3.95 32.1 0 29.75 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(255, 224, 224)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
