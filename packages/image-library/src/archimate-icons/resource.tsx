import type { SVGProps } from "react"

export function ResourceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 61 41" {...props}>
      <path
        d="M 30.6 13.6 L 30.6 26 M 21 13.6 L 21 26 M 11.4 13.6 L 11.4 26 M 54.6 16 C 55.8 15.6 57 15.6 58.2 16 C 59.4 16 60 16.4 60 17.2 C 60 19.2 60 20.8 60 22.8 C 60 23.2 59.4 23.6 58.8 24 C 57.6 24 55.8 24 54.6 24 M 0 29.2 C 0 24 0 17.2 0 10.8 C 0 9.6 1.8 8.4 4.8 8.4 C 19.8 8 36.6 8 50.4 8.4 C 52.8 8.8 53.4 9.6 54 10.4 C 54.6 16.4 54.6 22.8 54 28.8 C 54 29.6 52.8 31.2 49.8 31.6 C 34.2 31.6 19.2 31.6 3.6 31.6 C 1.2 31.2 0 30.4 0 29.2 Z"
        strokeMiterlimit="10"
        style={{
          fill: "rgb(245, 222, 170)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
    </svg>
  )
}
