"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

/** Result-count/footer-stats line + page-size and prev/next controls — split out of data-table.tsx to stay under max-lines. */
export function DataTablePagination({
  resultLabel,
  footerStats,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  pageIndex,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
}: {
  resultLabel: string
  footerStats?: React.ReactNode
  pageSize: number
  pageSizeOptions: number[]
  onPageSizeChange: (size: number) => void
  pageIndex: number
  pageCount: number
  canPreviousPage: boolean
  canNextPage: boolean
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {resultLabel}
        {footerStats && (
          <>
            {" · "}
            {footerStats}
          </>
        )}
      </span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-sm text-muted-foreground">
          Lignes
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-1.5 py-0.5 text-sm text-foreground"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-muted-foreground">
          Page {pageIndex + 1} / {pageCount || 1}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onPreviousPage}
          disabled={!canPreviousPage}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onNextPage}
          disabled={!canNextPage}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
