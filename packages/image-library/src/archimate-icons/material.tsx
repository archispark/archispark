import type { SVGProps } from "react"

export function MaterialIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 51" {...props}>
      <path
        d="M 0 25 L 15 0 L 45 0 L 60 25 L 45 50 L 15 50 Z M 9 25 L 18.6 10 M 41.4 10 L 51 25 M 40.8 40 L 19.2 40"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(175, 255, 175)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
