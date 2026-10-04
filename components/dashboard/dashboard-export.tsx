"use client"

import * as React from "react"
import { ChevronDown, Download, FileSpreadsheet, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMoney, useTenant } from "@/lib/data"
import { downloadCsv, exportFileName } from "@/lib/export"
import { useLocale } from "@/lib/i18n/provider"
import { PrintDocument, usePrint } from "@/lib/print"
import type { Kpi, SeriesPoint } from "@/lib/types"

type Stream = { key: string; label: string; total: number }
type Glance = { id: string; label: string; value: number }

const revenueOf = (point: SeriesPoint) =>
  point.rooms + point.fnb + point.spa + point.events + point.other

/**
 * The dashboard's Export: the daily figures behind the selected range as a
 * CSV, or the whole page as a printable summary (which is also Save as PDF).
 */
export function DashboardExportMenu({
  days,
  kpis,
  streams,
  glance,
}: {
  /** The series points in the selected range. */
  days: SeriesPoint[]
  kpis: Kpi[]
  streams: Stream[]
  glance: Glance[]
}) {
  const tenant = useTenant()
  const print = usePrint()
  const { t, tk, num, date } = useLocale()

  const exportCsv = () => {
    const roomsSold = (point: SeriesPoint) =>
      Math.round((point.occupancy / 100) * tenant.roomCount)
    downloadCsv(
      exportFileName(tenant, "daily-figures"),
      [
        { header: t("common.date"), value: (p: SeriesPoint) => p.date },
        {
          header: t("dashboard.export.occupancyPct"),
          value: (p) => p.occupancy,
        },
        { header: t("dashboard.export.roomsSold"), value: roomsSold },
        { header: t("dashboard.adr"), value: (p) => p.adr },
        { header: t("dashboard.revpar"), value: (p) => p.revpar },
        { header: t("dashboard.export.roomRevenue"), value: (p) => p.rooms },
        { header: t("dashboard.fnb"), value: (p) => p.fnb },
        { header: t("dashboard.spa"), value: (p) => p.spa },
        { header: t("dashboard.events"), value: (p) => p.events },
        { header: t("dashboard.other"), value: (p) => p.other },
        { header: t("dashboard.totalRevenue"), value: revenueOf },
      ],
      days
    )
    toast.success(
      tk(`dashboard.export.exported.${days.length === 1 ? "one" : "other"}`, {
        count: num(days.length),
      })
    )
  }

  const printSummary = () => {
    const from = days[0]?.date
    const to = days.at(-1)?.date
    print(
      <PrintDocument
        title={t("dashboard.export.summaryTitle")}
        reference={from && to ? `${date(from)} – ${date(to)}` : undefined}
      >
        <DashboardSummary
          days={days}
          kpis={kpis}
          streams={streams}
          glance={glance}
        />
      </PrintDocument>,
      { title: t("dashboard.export.summaryTitle"), size: "A4" }
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <Download />
        {t("common.export")}
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={exportCsv}>
          <FileSpreadsheet />
          {t("dashboard.export.dailyCsv")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={printSummary}>
          <Printer />
          {t("dashboard.export.print")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The printed dashboard: static tables, so nothing prints mid-animation. */
function DashboardSummary({
  days,
  kpis,
  streams,
  glance,
}: {
  days: SeriesPoint[]
  kpis: Kpi[]
  streams: Stream[]
  glance: Glance[]
}) {
  const money = useMoney()
  const { t, num, pct, date } = useLocale()
  const streamTotal = streams.reduce((sum, stream) => sum + stream.total, 0)

  const kpiValue = (kpi: Kpi) =>
    kpi.format === "percent"
      ? pct(kpi.value, 1)
      : kpi.format === "currency"
        ? money.format(kpi.value)
        : num(kpi.value)
  const signed = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${pct(Math.abs(value), 1)}`

  return (
    <div className="flex flex-col gap-6 text-xs">
      <section className="grid grid-cols-4 gap-2">
        {kpis.map((kpi) => (
          <div key={kpi.id} className="rounded-lg bg-muted/60 px-3 py-2.5">
            <div className="text-[0.625rem] text-muted-foreground">
              {t(kpi.labelKey as never)}
            </div>
            <div className="nums mt-0.5 text-base font-medium">
              {kpiValue(kpi)}
            </div>
            <div className="nums text-[0.625rem] text-muted-foreground">
              {signed(kpi.delta)} {t("common.vsLastPeriod")}
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h2 className="micro pb-1.5">{t("dashboard.revenueStreams")}</h2>
          <table className="w-full border-separate border-spacing-0">
            <tbody>
              {streams.map((stream) => (
                <tr key={stream.key}>
                  <td className="border-b border-[var(--hairline)] py-1.5">
                    {stream.label}
                  </td>
                  <td className="nums border-b border-[var(--hairline)] py-1.5 text-right">
                    {money.format(stream.total)}
                  </td>
                  <td className="nums w-14 border-b border-[var(--hairline)] py-1.5 text-right text-muted-foreground">
                    {pct(
                      streamTotal ? (stream.total / streamTotal) * 100 : 0,
                      0
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="micro pb-1.5">{t("dashboard.todayAtAGlance")}</h2>
          <table className="w-full border-separate border-spacing-0">
            <tbody>
              {glance.map((item) => (
                <tr key={item.id}>
                  <td className="border-b border-[var(--hairline)] py-1.5">
                    {item.label}
                  </td>
                  <td className="nums border-b border-[var(--hairline)] py-1.5 text-right">
                    {num(item.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section>
        <h2 className="micro pb-1.5">{t("dashboard.export.dailyFigures")}</h2>
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {[
                t("common.date"),
                t("dashboard.occupancy"),
                t("dashboard.adr"),
                t("dashboard.revpar"),
                t("dashboard.totalRevenue"),
              ].map((label, index) => (
                <th
                  key={label}
                  className={
                    index === 0
                      ? "micro border-b border-[var(--hairline)] py-1.5 text-left"
                      : "micro border-b border-[var(--hairline)] py-1.5 text-right"
                  }
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((point) => (
              <tr key={point.date} className="break-inside-avoid">
                <td className="nums border-b border-[var(--hairline)] py-1">
                  {date(point.date, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td className="nums border-b border-[var(--hairline)] py-1 text-right">
                  {pct(point.occupancy, 1)}
                </td>
                <td className="nums border-b border-[var(--hairline)] py-1 text-right">
                  {money.format(point.adr)}
                </td>
                <td className="nums border-b border-[var(--hairline)] py-1 text-right">
                  {money.format(point.revpar)}
                </td>
                <td className="nums border-b border-[var(--hairline)] py-1 text-right">
                  {money.format(revenueOf(point))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
