"use client"

import {
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type RowSelectionState,
  type Row,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import React, { useMemo, useState } from "react"
import { useT } from "@/lib/i18n"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"
import { ArrowUpDown, ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@workspace/ui/components/table"
import { Button } from "@workspace/ui/components/button"
import { DataTableSearch } from "@/components/data-table-search"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  pageSize?: number
  pageSizeOptions?: number[]
  renderSubRow?: (row: Row<TData>) => React.ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  searchAction?: React.ReactNode
  searchTableGapClassName?: string
  initialSorting?: SortingState
  selectable?: boolean
  onBulkDelete?: (rows: TData[]) => void
  getRowId?: (row: TData) => string
  footerStats?: React.ReactNode
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  pageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  renderSubRow,
  searchable,
  searchPlaceholder = "Rechercher…",
  searchAction,
  searchTableGapClassName,
  initialSorting,
  selectable,
  onBulkDelete,
  getRowId,
  footerStats,
}: DataTableProps<TData, TValue>) {
  const defaultSorting = useMemo(() => initialSorting ?? [], [])
  const [sorting, setSorting] = useState<SortingState>(defaultSorting)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })
  const [globalFilter, setGlobalFilter] = useState("")

  const selectColumn: ColumnDef<TData, unknown> = useMemo(
    () => ({
      id: "__select__",
      header: ({ table: t }) => (
        <input
          type="checkbox"
          checked={t.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = t.getIsSomePageRowsSelected()
          }}
          onChange={t.getToggleAllPageRowsSelectedHandler()}
          className="size-3.5 cursor-pointer"
          aria-label="Tout sélectionner"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="size-3.5 cursor-pointer"
          aria-label="Sélectionner"
        />
      ),
      enableSorting: false,
      size: 32,
    }),
    []
  )

  const allColumns = useMemo(
    () => (selectable ? [selectColumn, ...columns] : columns),
    [selectable, selectColumn, columns]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, pagination, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onGlobalFilterChange: (v) => {
      setGlobalFilter(v)
      setPagination((p) => ({ ...p, pageIndex: 0 }))
    },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: !!selectable,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  })

  const { t } = useT()
  const [pendingBulkDelete, setPendingBulkDelete] = useState<TData[] | null>(
    null
  )
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
  const selectedCount = selectedRows.length

  return (
    <div className="space-y-2">
      {selectable && selectedCount > 0 && onBulkDelete && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[13px]">
          <span className="font-medium text-destructive">
            {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setPendingBulkDelete(selectedRows)}
          >
            <Trash2 className="size-3.5" /> {t("common.delete")}
          </Button>
          <button
            type="button"
            onClick={() => setRowSelection({})}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Annuler
          </button>
        </div>
      )}
      <div className={searchTableGapClassName ?? "space-y-2"}>
        {searchable && (
          <DataTableSearch
            value={globalFilter}
            onChange={table.setGlobalFilter}
            placeholder={searchPlaceholder}
            action={searchAction}
          />
        )}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="flex items-center gap-1 transition-colors hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          <ArrowUpDown className="size-3.5 text-muted-foreground" />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading && data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Aucun élément trouvé
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableRow>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {renderSubRow && row.getIsExpanded() && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell
                          colSpan={columns.length}
                          className="px-4 py-2"
                        >
                          {renderSubRow(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {t("common.results", {
            n: table.getFilteredRowModel().rows.length,
            s: table.getFilteredRowModel().rows.length !== 1 ? "s" : "",
          })}
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
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
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
            Page {table.getState().pagination.pageIndex + 1} /{" "}
            {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <Dialog
        open={!!pendingBulkDelete}
        onOpenChange={(o) => !o && setPendingBulkDelete(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("common.bulk_delete_title")}</DialogTitle>
            <DialogDescription>
              {t("common.bulk_delete_desc", {
                n: pendingBulkDelete?.length ?? 0,
                s: (pendingBulkDelete?.length ?? 0) !== 1 ? "s" : "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                onBulkDelete!(pendingBulkDelete!)
                setRowSelection({})
                setPendingBulkDelete(null)
              }}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
