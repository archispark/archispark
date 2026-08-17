import type { SVGProps } from "react"

export function WorkPackageIcon(props: SVGProps<SVGSVGElement>) {
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
        <path
          d="M-9.3 12 C-8.4 9.7 -9.6 7.1 -12 6.3 C-14.3 5.4 -16.9 6.6 -17.7 9 C-18.6 11.3 -17.4 13.9 -15 14.7 C-14.4 15 -13.8 15 -13.1 15 M-13.5 15 L-7 15"
          fill="none"
        />
        <path d="M-7 12 L-3 15 L-7 18 Z" fill="currentColor" />
      </g>
    </svg>
  )
}
