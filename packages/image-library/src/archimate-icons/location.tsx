import type { SVGProps } from "react"

export function LocationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 36 51" {...props}>
      <path
        d="M 17.5 0 C 11.24 0 3 5.03 3 15 C 3 20.36 5.25 23.89 7.42 27.43 C 11.41 33.94 15.4 39.97 17.5 50 C 19.6 39.97 23.59 33.94 27.58 27.43 C 29.75 23.89 32 20.36 32 15 C 32 5.03 23.76 0 17.5 0 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(239, 209, 228)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
