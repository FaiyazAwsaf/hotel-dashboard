"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table"
import { motion } from "motion/react"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/motion/card-shell"
import { ScrollFade } from "@/components/motion/scroll-fade"
import { cn } from "@/lib/utils"
import { useTenant } from "@/lib/data"
import {
  downloadCsv,
  exportFileName,
  type CsvColumn,
  type CsvValue,
} from "@/lib/export"
import { useLocale } from "@/lib/i18n/provider"

export type { ColumnDef }

declare module "@tanstack/react-table" {
  // The generic parameters must match the library's declaration.
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "right"
    /**
     * The value written to CSV exports. Defaults to the accessor value, which
     * for enum columns is a raw key like `checkedIn` — map those to labels.
     */
    exportValue?: (row: TData) => CsvValue
    /** Leave this column out of CSV exports. */
    export?: false
  }
}

/**
 * crm.jpg's table: hairline rows, accent bulk-select checkboxes with an
 * indeterminate header state, click-to-sort headers and a sticky header band.
 *
 * Selecting rows opens a selection bar under the toolbar: the count, "select
 * all" across pages, an Export of the selected rows, and any `bulkActions`
 * the page supplies. Only rows the current search and filters show stay
 * selected — a new search clears the selection, and rows that leave `data`
 * (a filter pill, an edit) leave it too.
 */
export function DataTable<T>({
  data,
  columns,
  globalFilter,
  onGlobalFilterChange,
  selectable = false,
  bulkActions,
  exportName = "export",
  onRowClick,
  rowId,
  emptyIcon,
  className,
  toolbar,
  pageSize = 50,
}: {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void
  selectable?: boolean
  /** Actions for the selected rows, shown in the selection bar. */
  bulkActions?: (rows: T[], clearSelection: () => void) => React.ReactNode
  /** English slug for exported file names, e.g. `"bookings"`. */
  exportName?: string
  onRowClick?: (row: T) => void
  rowId?: (row: T) => string
  emptyIcon?: React.ReactNode
  className?: string
  toolbar?: React.ReactNode
  pageSize?: number
}) {
  const { t, num } = useLocale()
  const tenant = useTenant()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  // TanStack caches accessor values per row until `data` changes, so columns
  // rebuilt for another language would keep searching, sorting and exporting
  // the old language's values. A fresh array whenever the columns change
  // drops that cache.
  const rowsData = React.useMemo(
    () => data.slice(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- columns is the trigger
    [data, columns]
  )

  const table = useReactTable({
    data: rowsData,
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Paginated rather than virtualised: a hotel's booking list runs to
    // thousands of rows, and rendering them all stalls the first paint.
    getPaginationRowModel: getPaginationRowModel(),
    // Pagination is reset by hand below, so an edit to a row on page 3 keeps
    // the reader on page 3.
    autoResetPageIndex: false,
    initialState: { pagination: { pageSize } },
    getRowId: rowId ? (row) => rowId(row) : undefined,
  })

  const clearSelection = React.useCallback(() => setRowSelection({}), [])

  // Back to the first page for a new search, a new sort, or a different first
  // row — a filter pill or a newly added record — but not for in-place edits.
  const firstRowId = data.length > 0 && rowId ? rowId(data[0]) : ""
  React.useEffect(() => {
    table.setPageIndex(0)
  }, [table, globalFilter, sorting, firstRowId])

  // Rows removed by an edit can leave the current page past the end.
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  React.useEffect(() => {
    if (pageCount > 0 && pageIndex >= pageCount) {
      table.setPageIndex(pageCount - 1)
    }
  }, [table, pageCount, pageIndex])

  // A new search starts a new selection, so nothing stays selected out of sight.
  React.useEffect(() => {
    setRowSelection((current) =>
      Object.keys(current).length > 0 ? {} : current
    )
  }, [globalFilter])

  // Rows that leave the data — a filter pill, a property switch, an edit that
  // moves a row out of the current filter — leave the selection with them.
  React.useEffect(() => {
    setRowSelection((current) => {
      const ids = Object.keys(current)
      if (ids.length === 0) return current
      const present = new Set(table.getCoreRowModel().rows.map((row) => row.id))
      const kept = ids.filter((id) => present.has(id))
      return kept.length === ids.length
        ? current
        : Object.fromEntries(kept.map((id) => [id, true]))
    })
  }, [data, table])

  const rows = table.getRowModel().rows
  // In on-screen order, so an export follows the current sort.
  const selectedRows = table
    .getPrePaginationRowModel()
    .rows.filter((row) => row.getIsSelected())
  const selectedCount = selectedRows.length
  const filteredCount = table.getFilteredRowModel().rows.length

  const exportSelected = () => {
    downloadCsv(
      exportFileName(tenant, exportName),
      exportColumns(table.getAllLeafColumns()),
      selectedRows
    )
    toast.success(t("common.exportedRows", { count: num(selectedCount) }))
  }

  return (
    <div
      data-slot="data-table"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className
      )}
    >
      {toolbar ? (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--hairline)] px-3">
          {toolbar}
        </div>
      ) : null}
      {selectedCount > 0 ? (
        <motion.div
          data-slot="selection-bar"
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--hairline)] bg-primary/[0.04] px-3"
        >
          <span className="nums rounded-full bg-primary/12 px-2 py-0.5 text-[0.625rem] font-medium text-primary">
            {t("common.selected", { count: num(selectedCount) })}
          </span>
          {table.getIsAllPageRowsSelected() && selectedCount < filteredCount ? (
            <button
              type="button"
              onClick={() => table.toggleAllRowsSelected(true)}
              className="nums text-[0.625rem] font-medium text-primary hover:underline"
            >
              {t("common.selectAll", { count: num(filteredCount) })}
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5">
            {bulkActions?.(
              selectedRows.map((row) => row.original),
              clearSelection
            )}
            <Button variant="outline" size="sm" onClick={exportSelected}>
              <Download />
              {t("common.export")}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={clearSelection}
              aria-label={t("common.clearSelection")}
              title={t("common.clearSelection")}
            >
              <X />
            </Button>
          </div>
        </motion.div>
      ) : null}

      <ScrollFade className="min-h-0 flex-1">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {selectable ? (
                  <th className="w-8 border-b border-[var(--hairline)] bg-surface/95 px-3 py-2 backdrop-blur-xl">
                    <Checkbox
                      checked={table.getIsAllPageRowsSelected()}
                      indeterminate={table.getIsSomePageRowsSelected()}
                      onCheckedChange={(checked) =>
                        table.toggleAllPageRowsSelected(!!checked)
                      }
                      aria-label={t("common.selectPage")}
                    />
                  </th>
                ) : null}
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const align = header.column.columnDef.meta?.align
                  return (
                    <th
                      key={header.id}
                      onClick={
                        sortable
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      className={cn(
                        "border-b border-[var(--hairline)] bg-surface/95 px-3 py-2 text-[0.625rem] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase backdrop-blur-xl",
                        align === "right" ? "text-right" : "text-left",
                        sortable &&
                          "cursor-pointer select-none hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          align === "right" && "flex-row-reverse"
                        )}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-2.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-2.5" />
                        ) : null}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index, 18) * 0.012 }}
                onClick={() => onRowClick?.(row.original)}
                className={cn(
                  "group/row transition-colors",
                  row.getIsSelected()
                    ? "bg-primary/[0.06]"
                    : "hover:bg-muted/50",
                  onRowClick && "cursor-pointer"
                )}
              >
                {selectable ? (
                  <td
                    className="border-b border-[var(--hairline)] px-3 py-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Checkbox
                      checked={row.getIsSelected()}
                      onCheckedChange={(checked) =>
                        row.toggleSelected(!!checked)
                      }
                      aria-label={t("common.selectRow")}
                    />
                  </td>
                ) : null}
                {row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "border-b border-[var(--hairline)] px-3 py-2 align-middle",
                        align === "right" && "nums text-right tabular-nums"
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  )
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <EmptyState
            icon={emptyIcon ?? <Search />}
            title={t("common.noResults")}
            hint={t("common.noResultsHint")}
          />
        ) : null}
      </ScrollFade>

      {table.getPageCount() > 1 ? (
        <div className="flex h-9 shrink-0 items-center gap-2 border-t border-[var(--hairline)] px-3">
          <span className="nums text-[0.625rem] text-muted-foreground">
            {num(table.getState().pagination.pageIndex * pageSize + 1)}–
            {num(
              Math.min(
                (table.getState().pagination.pageIndex + 1) * pageSize,
                table.getFilteredRowModel().rows.length
              )
            )}{" "}
            {t("common.of")} {num(table.getFilteredRowModel().rows.length)}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="nums px-1.5 text-[0.625rem] text-muted-foreground">
              {num(table.getState().pagination.pageIndex + 1)} /{" "}
              {num(table.getPageCount())}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * CSV columns from the table's columns: every column with a plain-text header
 * and a value — an accessor, or `meta.exportValue` — unless it opts out.
 */
function exportColumns<T>(columns: Column<T>[]): CsvColumn<Row<T>>[] {
  return columns.flatMap((column) => {
    const { header, meta } = column.columnDef
    if (meta?.export === false || typeof header !== "string") return []
    // On screen headers are uppercased by CSS; some labels are lowercase words.
    const label = header.charAt(0).toUpperCase() + header.slice(1)
    const exportValue = meta?.exportValue
    if (exportValue) {
      return [
        { header: label, value: (row: Row<T>) => exportValue(row.original) },
      ]
    }
    if (!column.accessorFn) return []
    return [
      {
        header: label,
        value: (row: Row<T>) => csvValue(row.getValue(column.id)),
      },
    ]
  })
}

function csvValue(value: unknown): CsvValue {
  if (value instanceof Date) return value.toISOString()
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }
  return null
}

/** Shared search input for table toolbars. */
export function TableSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const { t } = useLocale()
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? t("common.search")}
        className="h-7 w-[180px] rounded-full border border-border bg-card pr-2.5 pl-7 text-[0.6875rem] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </div>
  )
}
