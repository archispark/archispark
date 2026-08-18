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
      <rect x="4" y="5" width="11" height="7" fill="none" />
      <rect x="4" y="12" width="24" height="15" fill="none" />
    </svg>
  )
}
