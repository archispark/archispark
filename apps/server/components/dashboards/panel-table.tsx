"use client"

import { useMemo, useState, type CSSProperties } from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { getLayer, LAYER_BADGE_COLORS } from "@/lib/archimate-helpers"
import { useT } from "@/lib/i18n"

export interface PanelTableColumnOptions {
  width?: number
  minWidth?: number
  wrap?: boolean
  hidden?: boolean
  align?: "left" | "center" | "right"
}

export interface PanelTableProps {
  rows: Record<string, unknown>[]
  columnOrder?: readonly string[]
  columns?: Readonly<Record<string, PanelTableColumnOptions>>
  freezeFirstColumn?: boolean
  initialPageSize?: 25 | 50 | 100
}

type SortDirection = "asc" | "desc"

function renderCell(column: string, value: unknown) {
  if (column === "Type" && typeof value === "string" && value) {
    return (
      <Badge variant="outline" className={LAYER_BADGE_COLORS[getLayer(value)]}>
        {value}
      </Badge>
    )
  }
  if (column === "Couche" && typeof value === "string" && LAYER_BADGE_COLORS[value]) {
    return (
      <Badge variant="outline" className={LAYER_BADGE_COLORS[value]}>
        {value}
      </Badge>
    )
  }
  if (value && typeof value === "object") return JSON.stringify(value)
  return String(value ?? "")
}

export function compareTableValues(left: unknown, right: unknown, locale = "fr"): number {
  const leftEmpty = left === null || left === undefined || left === ""
  const rightEmpty = right === null || right === undefined || right === ""
  if (leftEmpty || rightEmpty) return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1
  if (typeof left === "number" && typeof right === "number") return left - right
  return String(left).localeCompare(String(right), locale, { numeric: true, sensitivity: "base" })
}

export function PanelTable({
  rows,
  columnOrder = [],
  columns: columnOptions = {},
  freezeFirstColumn = false,
  initialPageSize = 25,
}: PanelTableProps) {
  const { t, locale } = useT()
  const [sort, setSort] = useState<{ column: string; direction: SortDirection }>()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const availableColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const requestedColumns = columnOrder.filter((column) => availableColumns.includes(column))
  const columns = [
    ...requestedColumns,
    ...availableColumns.filter((column) => !requestedColumns.includes(column)),
  ].filter((column) => !columnOptions[column]?.hidden)
  const sortedRows = useMemo(() => {
    if (!sort) return rows
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const compared = compareTableValues(a.row[sort.column], b.row[sort.column], locale)
        return compared === 0 ? a.index - b.index : sort.direction === "asc" ? compared : -compared
      })
      .map(({ row }) => row)
  }, [rows, sort, locale])
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleRows = sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("panels.table_empty")}</p>

  const toggleSort = (column: string) => {
    setPage(0)
    setSort((current) =>
      !current || current.column !== column
        ? { column, direction: "asc" }
        : current.direction === "asc"
          ? { column, direction: "desc" }
          : undefined
    )
  }
  const styleFor = (column: string, index: number): CSSProperties => ({
    width: columnOptions[column]?.width,
    minWidth: columnOptions[column]?.minWidth,
    textAlign: columnOptions[column]?.align,
    ...(freezeFirstColumn && index === 0 ? { position: "sticky", left: 0, zIndex: 1 } : {}),
  })

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border">
      <div className="relative w-full max-w-full overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="bg-muted [&_tr]:border-b [&_tr]:border-border">
            <tr>
              {columns.map((column, index) => {
                const active = sort?.column === column
                const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown
                return (
                  <th
                    key={column}
                    style={styleFor(column, index)}
                    className="h-10 bg-muted px-2 text-left align-middle font-medium whitespace-nowrap text-foreground"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className="inline-flex items-center gap-1"
                      aria-label={t("panels.sort_column", { column })}
                    >
                      {column}
                      <Icon size={13} aria-hidden="true" />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {visibleRows.map((row, rowIndex) => (
              <tr key={currentPage * pageSize + rowIndex} className="border-b border-border transition-colors hover:bg-muted/50">
                {columns.map((column, index) => (
                  <td
                    key={column}
                    style={styleFor(column, index)}
                    className={`bg-card p-2 align-middle ${columnOptions[column]?.wrap ? "whitespace-normal break-words" : "whitespace-nowrap"}`}
                  >
                    {renderCell(column, row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>
          {t("panels.pagination_range", {
            from: currentPage * pageSize + 1,
            to: Math.min((currentPage + 1) * pageSize, rows.length),
            total: rows.length,
          })}
        </span>
        <div className="flex items-center gap-2">
          <label>
            {t("panels.pagination_page_size")}{" "}
            <select
              className="rounded border border-border bg-background px-1 py-0.5"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as 25 | 50 | 100)
                setPage(0)
              }}
            >
              <option>25</option>
              <option>50</option>
              <option>100</option>
            </select>
          </label>
          <button
            type="button"
            className="rounded border border-border px-2 py-1 disabled:opacity-40"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            {t("panels.pagination_previous")}
          </button>
          <span>
            {currentPage + 1}/{pageCount}
          </span>
          <button
            type="button"
            className="rounded border border-border px-2 py-1 disabled:opacity-40"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            {t("panels.pagination_next")}
          </button>
        </div>
      </div>
    </div>
  )
}
