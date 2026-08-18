import type { SVGProps } from "react"

export function CourseOfActionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="-0.5 -0.5 41 41" {...props}>
      <ellipse
        cx="28"
        cy="12"
        rx="12"
        ry="12"
        style={{
          fill: "rgb(245, 222, 170)",
          stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))",
        }}
      />
      <ellipse
        cx="28"
        cy="12"
        rx="8"
        ry="8"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <path
        d="M 0 40 C 2.54 31.96 8.56 25.5 16.4 22.4 M 5.6 21.6 L 16.4 22.4 L 12 31.2"
        strokeWidth="3"
        strokeLinecap="round"
        strokeMiterlimit="10"
        style={{ stroke: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
      <ellipse
        cx="28"
        cy="12"
        rx="4"
        ry="4"
        style={{ fill: "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))" }}
      />
    </svg>
  )
}
