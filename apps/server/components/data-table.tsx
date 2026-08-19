"use client"

import {
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type RowSelectionState,
  type Row,
  type RowData,
  useTable,
  tableFeatures,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  createExpandedRowModel,
  filterFn_includesString,
} from "@tanstack/react-table"
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react"
import { useT } from "@/lib/i18n"
import { DataTableGrid } from "@/components/data-table-grid"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DataTableBulkDeleteDialog } from "@/components/data-table-bulk-delete-dialog"
import { DataTableSearch } from "@/components/data-table-search"

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  filterFns: { includesString: filterFn_includesString },
})

export type DataTableFeatures = typeof dataTableFeatures

export type DataTableColumnDef<
  TData extends RowData,
  TValue = unknown,
> = ColumnDef<DataTableFeatures, TData, TValue>

interface DataTableProps<TData extends RowData, TValue> {
  columns: DataTableColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  pageSize?: number
  pageSizeOptions?: number[]
  renderSubRow?: (row: Row<DataTableFeatures, TData>) => React.ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  searchAction?: React.ReactNode
  searchTableGapClassName?: string
  initialSorting?: SortingState
  selectable?: boolean
  /** Restricts which rows can be selected/bulk-deleted (e.g. system rows). Defaults to all rows selectable. */
  isRowSelectable?: (row: TData) => boolean
  onBulkDelete?: (rows: TData[]) => void
  /** Fires whenever the selection changes, so the page can drive an external bulk-delete trigger. */
  onSelectionChange?: (rows: TData[]) => void
  getRowId?: (row: TData) => string
  footerStats?: React.ReactNode
}

/** Imperative handle so a page-level button (e.g. next to "Ajouter") can open the bulk-delete confirmation. */
export interface DataTableHandle {
  requestBulkDelete: () => void
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function DataTableInner<TData extends RowData, TValue>(
  {
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
    isRowSelectable,
    onBulkDelete,
    onSelectionChange,
    getRowId,
    footerStats,
  }: DataTableProps<TData, TValue>,
  ref: React.ForwardedRef<DataTableHandle>
) {
  const defaultSorting = useMemo(() => initialSorting ?? [], [])
  const [sorting, setSorting] = useState<SortingState>(defaultSorting)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })
  const [globalFilter, setGlobalFilter] = useState("")

  const selectColumn: DataTableColumnDef<TData, unknown> = useMemo(
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
      cell: ({ row }) =>
        row.getCanSelect() ? (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            className="size-3.5 cursor-pointer"
            aria-label="Sélectionner"
          />
        ) : null,
      enableSorting: false,
      size: 32,
    }),
    []
  )

  const allColumns = useMemo(
    () =>
      (selectable ? [selectColumn, ...columns] : columns) as DataTableColumnDef<
        TData,
        unknown
      >[],
    [selectable, selectColumn, columns]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useTable({
    features: dataTableFeatures,
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
    enableRowSelection: !selectable
      ? false
      : isRowSelectable
        ? (row) => isRowSelectable(row.original)
        : true,
    getRowId,
    getRowCanExpand: () => true,
  })

  const { t } = useT()
  const [pendingBulkDelete, setPendingBulkDelete] = useState<TData[] | null>(
    null
  )
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)

  useEffect(() => {
    onSelectionChange?.(selectedRows)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedRows is derived fresh from rowSelection/data every render; only those should retrigger the notification
  }, [rowSelection, data])

  useImperativeHandle(ref, () => ({
    requestBulkDelete: () => {
      if (selectedRows.length > 0) setPendingBulkDelete(selectedRows)
    },
  }))

  return (
    <div className="space-y-2">
      <div className={searchTableGapClassName ?? "space-y-2"}>
        {searchable && (
          <DataTableSearch
            value={globalFilter}
            onChange={table.setGlobalFilter}
            placeholder={searchPlaceholder}
            action={searchAction}
          />
        )}
        <DataTableGrid
          headerGroups={table.getHeaderGroups()}
          rows={table.getRowModel().rows}
          columnCount={columns.length}
          loading={loading}
          hasData={data.length > 0}
          renderSubRow={renderSubRow}
        />
      </div>

      <DataTablePagination
        resultLabel={t("common.results", {
          n: table.getFilteredRowModel().rows.length,
          s: table.getFilteredRowModel().rows.length !== 1 ? "s" : "",
        })}
        footerStats={footerStats}
        pageSize={table.state.pagination.pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={(size) => table.setPageSize(size)}
        pageIndex={table.state.pagination.pageIndex}
        pageCount={table.getPageCount()}
        canPreviousPage={table.getCanPreviousPage()}
        canNextPage={table.getCanNextPage()}
        onPreviousPage={() => table.previousPage()}
        onNextPage={() => table.nextPage()}
      />

      <DataTableBulkDeleteDialog
        open={!!pendingBulkDelete}
        count={pendingBulkDelete?.length ?? 0}
        onOpenChange={(o) => !o && setPendingBulkDelete(null)}
        onConfirm={() => {
          onBulkDelete!(pendingBulkDelete!)
          setRowSelection({})
          setPendingBulkDelete(null)
        }}
      />
    </div>
  )
}

export const DataTable = forwardRef(DataTableInner) as <
  TData extends RowData,
  TValue = unknown,
>(
  props: DataTableProps<TData, TValue> & {
    ref?: React.ForwardedRef<DataTableHandle>
  }
) => React.ReactElement
