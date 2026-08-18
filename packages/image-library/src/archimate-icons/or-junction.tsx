import type { SVGProps } from "react"

export function OrJunctionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      {...props}
    >
      <g transform="translate(28 2)">
        <circle cx="-11" cy="12" r="4" fill="none" />
      </g>
    </svg>
  )
}
