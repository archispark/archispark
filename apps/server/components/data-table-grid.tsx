"use client"

import React from "react"
import {
  type HeaderGroup,
  type Row,
  type RowData,
  flexRender,
} from "@tanstack/react-table"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@workspace/ui/components/table"
import { ArrowUpDown } from "lucide-react"
import { type DataTableFeatures } from "@/components/data-table"

/** Header/body table rendering — split out of data-table.tsx to stay under max-lines. */
export function DataTableGrid<TData extends RowData>({
  headerGroups,
  rows,
  columnCount,
  loading,
  hasData,
  renderSubRow,
}: {
  headerGroups: HeaderGroup<DataTableFeatures, TData>[]
  rows: Row<DataTableFeatures, TData>[]
  columnCount: number
  loading?: boolean
  hasData: boolean
  renderSubRow?: (row: Row<DataTableFeatures, TData>) => React.ReactNode
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {headerGroups.map((headerGroup) => (
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
          {loading && !hasData ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="py-8 text-center text-muted-foreground"
              >
                Chargement...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="py-8 text-center text-muted-foreground"
              >
                Aucun élément trouvé
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
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
                    <TableCell colSpan={columnCount} className="px-4 py-2">
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
  )
}
