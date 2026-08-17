import type { SVGProps } from "react"

export function GroupingIcon(props: SVGProps<SVGSVGElement>) {
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
        <rect x="-18" y="6" width="6" height="3" fill="none" />
        <rect x="-18" y="9" width="13" height="7" fill="none" />
      </g>
    </svg>
  )
}
