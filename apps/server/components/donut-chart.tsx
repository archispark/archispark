"use client"

export interface SliceData {
  label: string
  count: number
  color: string
}

function polarXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutSlicePath(
  cx: number,
  cy: number,
  ro: number,
  ri: number,
  a0: number,
  a1: number
) {
  const sweep = a1 - a0
  const end = sweep >= 360 ? a0 + 359.999 : a1
  const os = polarXY(cx, cy, ro, a0)
  const oe = polarXY(cx, cy, ro, end)
  const is = polarXY(cx, cy, ri, end)
  const ie = polarXY(cx, cy, ri, a0)
  const large = sweep > 180 ? 1 : 0
  return (
    `M${os.x},${os.y} A${ro},${ro} 0 ${large} 1 ${oe.x},${oe.y}` +
    ` L${is.x},${is.y} A${ri},${ri} 0 ${large} 0 ${ie.x},${ie.y}Z`
  )
}

/** Generic donut/pie chart, no external dependency — takes pre-bucketed slices. */
export function DonutChart({
  data,
  total,
  centerLabel,
}: {
  data: SliceData[]
  total: number
  centerLabel: string
}) {
  const cx = 90,
    cy = 90,
    ro = 82,
    ri = 50
  let angle = 0

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <svg
        width={180}
        height={180}
        viewBox="0 0 180 180"
        className="shrink-0"
        aria-hidden="true"
      >
        {data.map(({ label, count, color }) => {
          const sweep = (count / total) * 360
          const a0 = angle
          angle += sweep
          return (
            <path
              key={label}
              d={donutSlicePath(cx, cy, ro, ri, a0, angle)}
              fill={color}
              stroke="var(--card, #fff)"
              strokeWidth={1.5}
            >
              <title>
                {label}: {count}
              </title>
            </path>
          )
        })}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fontSize={26}
          fontWeight="700"
          fill="currentColor"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 11}
          textAnchor="middle"
          fontSize={9}
          fill="currentColor"
          opacity={0.45}
        >
          {centerLabel}
        </text>
      </svg>

      <div className="grid w-full flex-1 grid-cols-2 gap-x-4 gap-y-2 self-center">
        {data.map(({ label, count, color }) => (
          <div key={label} className="flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: color }}
            />
            <span className="flex-1 truncate text-[12px] text-muted-foreground">
              {label}
            </span>
            <span className="text-[12px] font-semibold tabular-nums">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
