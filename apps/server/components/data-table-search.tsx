import { Search } from "lucide-react"
import type { ReactNode } from "react"

export function DataTableSearch({
  value,
  onChange,
  placeholder,
  action,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  action?: ReactNode
}) {
  return (
    <div
      className={
        action ? "relative flex flex-wrap items-center gap-2" : "relative"
      }
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-8 min-w-0 rounded-lg border border-border bg-background py-0 pr-3 pl-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring ${action ? "flex-1" : "w-full"}`}
      />
      {action}
    </div>
  )
}
