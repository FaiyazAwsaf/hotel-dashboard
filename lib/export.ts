import { demoToday, isoDay } from "@/lib/demo-time"
import type { Tenant } from "@/lib/types"

/**
 * CSV downloads, built entirely in the browser — there is no server to ask.
 *
 * Headers are whatever the caller passes, normally translated labels, so a
 * file exported in Bangla has Bangla headers. Values stay raw (plain numbers,
 * ISO dates) so the file sorts and sums properly in a spreadsheet.
 */

export type CsvValue = string | number | boolean | null | undefined

export type CsvColumn<T> = {
  header: string
  value: (row: T) => CsvValue
}

/** A cell a spreadsheet would run as a formula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/
/** Phone numbers and signed figures start with + or - but are harmless. */
const NUMBER_LIKE = /^[+-]?[\d\s().-]+$/

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : ""
  }
  if (typeof value === "boolean") return value ? "true" : "false"

  // A leading apostrophe makes spreadsheet apps treat the cell as text.
  const text =
    FORMULA_START.test(value) && !NUMBER_LIKE.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) || text !== text.trim()
    ? `"${text.replace(/"/g, '""')}"`
    : text
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: readonly T[]) {
  const lines = [
    columns.map((column) => cell(column.header)),
    ...rows.map((row) => columns.map((column) => cell(column.value(row)))),
  ]
  return lines.map((line) => line.join(",")).join("\r\n")
}

/**
 * `sarina-gulshan-bookings-2026-10-05.csv`. `subject` is an English slug —
 * filenames stay ASCII whatever the interface language.
 */
export function exportFileName(
  tenant: Pick<Tenant, "slug">,
  subject: string,
  extension = "csv"
) {
  const slug =
    subject
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "export"
  return `${tenant.slug}-${slug}-${isoDay(demoToday())}.${extension}`
}

export function downloadCsv<T>(
  fileName: string,
  columns: CsvColumn<T>[],
  rows: readonly T[]
) {
  // The byte-order mark makes Excel read the file as UTF-8, which keeps
  // Bangla text intact; without it Excel assumes the system code page.
  const blob = new Blob(["﻿", toCsv(columns, rows)], {
    type: "text/csv;charset=utf-8",
  })
  downloadBlob(fileName, blob)
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
