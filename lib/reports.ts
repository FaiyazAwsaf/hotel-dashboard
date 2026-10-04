"use client"

import * as React from "react"
import { toast } from "sonner"

import { useDataset, useLookups, useTenant } from "@/lib/data"
import { addDays, demoToday, isoDay, startOfMonth } from "@/lib/demo-time"
import { downloadCsv, exportFileName, type CsvColumn } from "@/lib/export"
import { invoiceBreakdown, invoiceStays } from "@/lib/finance"
import { useLocale } from "@/lib/i18n/provider"
import { SOURCE_LABEL } from "@/lib/labels"
import { createRng } from "@/lib/mock/rng"
import type {
  Bilingual,
  CompanySegment,
  HousekeepingTask,
  LoyaltyTier,
  Reservation,
  SeriesPoint,
  TagHue,
  Tenant,
} from "@/lib/types"

/* ------------------------------------------------------------------ *
 * The report library
 * ------------------------------------------------------------------ */

export type ReportCategory =
  "operations" | "revenue" | "guest" | "staff" | "compliance"

export type ReportId =
  | "nightAudit"
  | "managerFlash"
  | "pace"
  | "housekeeping"
  | "satisfaction"
  | "segment"
  | "vat"
  | "police"
  | "arrivals"
  | "fnbCost"
  | "attendance"
  | "loyalty"

type ReportText = {
  name: Bilingual
  /** What the report covers; also the request handed to Report studio. */
  brief: Bilingual
}

export type ReportDefinition = ReportText & {
  id: ReportId
  category: ReportCategory
  hue: TagHue
  schedule: Bilingual
  ai?: boolean
  /** Wording for properties whose sales tax is GST rather than VAT. */
  gst?: ReportText
}

export const REPORTS: ReportDefinition[] = [
  {
    id: "nightAudit",
    name: { en: "Night audit", bn: "নাইট অডিট" },
    brief: {
      en: "Night audit: in-house guests, room rates and open balances",
      bn: "নাইট অডিট: অবস্থানরত অতিথি, কক্ষ ভাড়া ও বকেয়া ব্যালান্স",
    },
    category: "operations",
    hue: "blue",
    schedule: { en: "Daily 03:00", bn: "প্রতিদিন ৩:০০" },
  },
  {
    id: "managerFlash",
    name: { en: "Manager flash", bn: "ম্যানেজার ফ্ল্যাশ" },
    brief: {
      en: "Manager flash: today, yesterday and month to date — occupancy, ADR, RevPAR and revenue",
      bn: "ম্যানেজার ফ্ল্যাশ: আজ, গতকাল ও মাসের শুরু থেকে — অকুপেন্সি, গড় দৈনিক ভাড়া, রেভপার ও রাজস্ব",
    },
    category: "revenue",
    hue: "green",
    schedule: { en: "Daily 07:00", bn: "প্রতিদিন ৭:০০" },
    ai: true,
  },
  {
    id: "pace",
    name: { en: "Pace report", bn: "পেস রিপোর্ট" },
    brief: {
      en: "Pace report: rooms on the books for the next 90 days against the forecast",
      bn: "পেস রিপোর্ট: আগামী ৯০ দিনে বুক হওয়া কক্ষ বনাম পূর্বাভাস",
    },
    category: "revenue",
    hue: "teal",
    schedule: { en: "Weekly", bn: "সাপ্তাহিক" },
    ai: true,
  },
  {
    id: "housekeeping",
    name: { en: "Housekeeping productivity", bn: "হাউসকিপিং উৎপাদনশীলতা" },
    brief: {
      en: "Housekeeping productivity by attendant: rooms assigned and completed, minutes per room",
      bn: "অ্যাটেনড্যান্ট অনুযায়ী হাউসকিপিং উৎপাদনশীলতা: বরাদ্দ ও সম্পন্ন কক্ষ, কক্ষপ্রতি মিনিট",
    },
    category: "staff",
    hue: "purple",
    schedule: { en: "Weekly", bn: "সাপ্তাহিক" },
  },
  {
    id: "satisfaction",
    name: { en: "Guest satisfaction", bn: "অতিথি সন্তুষ্টি" },
    brief: {
      en: "Guest satisfaction over the last 30 days by category, with likelihood to recommend",
      bn: "গত ৩০ দিনের অতিথি সন্তুষ্টি, বিষয় অনুযায়ী, সুপারিশের সম্ভাবনাসহ",
    },
    category: "guest",
    hue: "magenta",
    schedule: { en: "Monthly", bn: "মাসিক" },
    ai: true,
  },
  {
    id: "segment",
    name: { en: "Segment performance", bn: "সেগমেন্ট কর্মক্ষমতা" },
    brief: {
      en: "Segment performance: account value and room nights by market segment",
      bn: "সেগমেন্ট কর্মক্ষমতা: মার্কেট সেগমেন্ট অনুযায়ী অ্যাকাউন্ট মূল্য ও কক্ষ-রাত",
    },
    category: "revenue",
    hue: "amber",
    schedule: { en: "Monthly", bn: "মাসিক" },
  },
  {
    id: "vat",
    name: { en: "VAT return", bn: "ভ্যাট রিটার্ন" },
    brief: {
      en: "VAT return: room charges, service charge and VAT on every invoice",
      bn: "ভ্যাট রিটার্ন: প্রতিটি চালানের কক্ষ ভাড়া, সার্ভিস চার্জ ও ভ্যাট",
    },
    gst: {
      name: { en: "GST return", bn: "জিএসটি রিটার্ন" },
      brief: {
        en: "GST return: room charges, service charge and GST on every invoice",
        bn: "জিএসটি রিটার্ন: প্রতিটি চালানের কক্ষ ভাড়া, সার্ভিস চার্জ ও জিএসটি",
      },
    },
    category: "compliance",
    hue: "slate",
    schedule: { en: "Monthly", bn: "মাসিক" },
  },
  {
    id: "police",
    name: { en: "Foreign guest register", bn: "বিদেশি অতিথি নিবন্ধন" },
    brief: {
      en: "Foreign guest register: foreign nationals in house or arriving today",
      bn: "বিদেশি অতিথি নিবন্ধন: অবস্থানরত বা আজ আসছেন এমন বিদেশি নাগরিক",
    },
    category: "compliance",
    hue: "rose",
    schedule: { en: "Daily", bn: "প্রতিদিন" },
  },
  {
    id: "arrivals",
    name: { en: "Arrivals & departures", bn: "আগমন ও প্রস্থান" },
    brief: {
      en: "Today's arrivals and departures, with rooms and balances",
      bn: "আজকের আগমন ও প্রস্থান, কক্ষ ও ব্যালান্সসহ",
    },
    category: "operations",
    hue: "blue",
    schedule: { en: "Daily 06:00", bn: "প্রতিদিন ৬:০০" },
  },
  {
    id: "fnbCost",
    name: { en: "F&B cost of sales", bn: "খাদ্য ও পানীয়ের ব্যয়" },
    brief: {
      en: "F&B cost of sales for the last four weeks, with cost percentage and gross profit",
      bn: "গত চার সপ্তাহের খাদ্য ও পানীয়ের বিক্রয় ব্যয়, ব্যয়ের হার ও মোট মুনাফাসহ",
    },
    category: "revenue",
    hue: "amber",
    schedule: { en: "Weekly", bn: "সাপ্তাহিক" },
  },
  {
    id: "attendance",
    name: { en: "Attendance summary", bn: "উপস্থিতির সারসংক্ষেপ" },
    brief: {
      en: "Attendance summary for the last 7 days, by staff member",
      bn: "কর্মী অনুযায়ী গত ৭ দিনের উপস্থিতির সারসংক্ষেপ",
    },
    category: "staff",
    hue: "green",
    schedule: { en: "Weekly", bn: "সাপ্তাহিক" },
  },
  {
    id: "loyalty",
    name: { en: "Loyalty tier movement", bn: "লয়্যালটি স্তর পরিবর্তন" },
    brief: {
      en: "Loyalty tier movement: members upgraded and downgraded this month",
      bn: "লয়্যালটি স্তর পরিবর্তন: এ মাসে যাঁদের স্তর বেড়েছে বা কমেছে",
    },
    category: "guest",
    hue: "teal",
    schedule: { en: "Monthly", bn: "মাসিক" },
    ai: true,
  },
]

/** The report's name and brief as this property words them. */
export function reportText(report: ReportDefinition, tenant: Tenant) {
  return tenant.tax.name === "gst" && report.gst ? report.gst : report
}

/* ------------------------------------------------------------------ *
 * Downloads
 * ------------------------------------------------------------------ */

const TIER_ORDER: LoyaltyTier[] = ["member", "silver", "gold", "platinum"]

const round1 = (value: number) => Math.round(value * 10) / 10
const share = (part: number, whole: number) =>
  whole > 0 ? round1((part / whole) * 100) : 0

/** Not cancelled and not a no-show. */
const isLive = (reservation: Reservation) =>
  reservation.status !== "cancelled" && reservation.status !== "noShow"

/**
 * `download("pace")` saves that report as a CSV, built from the property's
 * data in the interface language.
 *
 * Three reports have no source data of their own — survey scores, F&B costs
 * and tier history — so their figures come from their own seeded generator,
 * keyed to the stay, day or guest. They are stable across reloads and never
 * shift the rest of the dataset.
 */
export function useReportDownload() {
  const data = useDataset()
  const lookups = useLookups()
  const tenant = useTenant()
  const { t, tk, locale, num } = useLocale()

  return React.useCallback(
    (id: ReportId) => {
      const report = REPORTS.find((entry) => entry.id === id)
      if (!report) return

      const today = isoDay(demoToday())
      const yesterday = isoDay(addDays(demoToday(), -1))
      const daysAgo = (days: number) => isoDay(addDays(demoToday(), -days))

      const guestName = (guestId: string) =>
        lookups.guest.get(guestId)?.name[locale] ?? ""
      const roomNumber = (roomId: string) =>
        lookups.room.get(roomId)?.number ?? ""
      const roomType = (r: Reservation) => tk(`rooms.types.${r.roomTypeId}`)
      const byRoom = (a: Reservation, b: Reservation) =>
        roomNumber(a.roomId).localeCompare(roomNumber(b.roomId), undefined, {
          numeric: true,
        })

      let count = 0
      const download = <T>(
        subject: string,
        columns: CsvColumn<T>[],
        rows: readonly T[]
      ) => {
        downloadCsv(exportFileName(tenant, subject), columns, rows)
        count = rows.length
      }

      switch (id) {
        case "nightAudit": {
          const inHouse = data.reservations
            .filter((r) => r.status === "checkedIn")
            .sort(byRoom)
          download<Reservation>(
            "night-audit",
            [
              { header: t("common.room"), value: (r) => roomNumber(r.roomId) },
              { header: t("bookings.roomType"), value: roomType },
              { header: t("common.guest"), value: (r) => guestName(r.guestId) },
              { header: t("bookings.bookingId"), value: (r) => r.code },
              { header: t("bookings.checkInDate"), value: (r) => r.checkIn },
              { header: t("bookings.checkOutDate"), value: (r) => r.checkOut },
              { header: t("reports.columns.nights"), value: (r) => r.nights },
              { header: t("reports.columns.rate"), value: (r) => r.rate },
              { header: t("common.total"), value: (r) => r.total },
              { header: t("finance.paid"), value: (r) => r.paid },
              {
                header: t("reports.columns.balance"),
                value: (r) => r.total - r.paid,
              },
              {
                header: t("bookings.source"),
                value: (r) => SOURCE_LABEL[r.source][locale],
              },
            ],
            inHouse
          )
          break
        }

        case "managerFlash": {
          const days = (from: string, to: string) =>
            data.series.filter((p) => p.date >= from && p.date <= to)
          const periods = [
            { points: days(today, today), from: today, to: today },
            {
              points: days(yesterday, yesterday),
              from: yesterday,
              to: yesterday,
            },
            {
              points: days(isoDay(startOfMonth(demoToday())), today),
              from: isoDay(startOfMonth(demoToday())),
              to: today,
            },
          ]
          const sum = (points: SeriesPoint[], f: (p: SeriesPoint) => number) =>
            points.reduce((total, point) => total + f(point), 0)
          const reservationsOn = (
            key: "checkIn" | "checkOut",
            from: string,
            to: string
          ) =>
            data.reservations.filter(
              (r) => isLive(r) && r[key] >= from && r[key] <= to
            ).length

          const figures = periods.map(({ points, from, to }) => {
            const sold = sum(points, (p) =>
              Math.round((p.occupancy / 100) * tenant.roomCount)
            )
            const available = tenant.roomCount * points.length
            const roomRevenue = sum(points, (p) => p.rooms)
            return {
              occupancy: share(sold, available),
              sold,
              adr: sold > 0 ? Math.round(roomRevenue / sold) : 0,
              revpar: available > 0 ? Math.round(roomRevenue / available) : 0,
              rooms: roomRevenue,
              fnb: sum(points, (p) => p.fnb),
              spa: sum(points, (p) => p.spa),
              events: sum(points, (p) => p.events),
              other: sum(points, (p) => p.other),
              total: sum(
                points,
                (p) => p.rooms + p.fnb + p.spa + p.events + p.other
              ),
              arrivals: reservationsOn("checkIn", from, to),
              departures: reservationsOn("checkOut", from, to),
            }
          })
          type Figures = (typeof figures)[number]
          const metrics: { label: string; key: keyof Figures }[] = [
            { label: t("dashboard.export.occupancyPct"), key: "occupancy" },
            { label: t("dashboard.export.roomsSold"), key: "sold" },
            { label: t("dashboard.adr"), key: "adr" },
            { label: t("dashboard.revpar"), key: "revpar" },
            { label: t("dashboard.export.roomRevenue"), key: "rooms" },
            { label: t("dashboard.fnb"), key: "fnb" },
            { label: t("dashboard.spa"), key: "spa" },
            { label: t("dashboard.events"), key: "events" },
            { label: t("dashboard.other"), key: "other" },
            { label: t("dashboard.totalRevenue"), key: "total" },
            { label: t("dashboard.arrivals"), key: "arrivals" },
            { label: t("dashboard.departures"), key: "departures" },
          ]
          download(
            "manager-flash",
            [
              { header: t("reports.columns.metric"), value: (m) => m.label },
              { header: t("common.today"), value: (m) => figures[0][m.key] },
              {
                header: t("common.yesterday"),
                value: (m) => figures[1][m.key],
              },
              {
                header: t("reports.columns.monthToDate"),
                value: (m) => figures[2][m.key],
              },
            ],
            metrics
          )
          break
        }

        case "pace": {
          // Rooms already sold for each night ahead.
          const onBooks = new Map<string, number>()
          for (const r of data.reservations) {
            if (!isLive(r) || r.status === "checkedOut") continue
            for (let night = 0; night < r.nights; night++) {
              const day = isoDay(addDays(new Date(r.checkIn), night))
              onBooks.set(day, (onBooks.get(day) ?? 0) + 1)
            }
          }
          const ahead = data.series.filter((p) => p.date > today)
          download<SeriesPoint>(
            "pace-report",
            [
              { header: t("common.date"), value: (p) => p.date },
              {
                header: t("reports.columns.roomsOnBooks"),
                value: (p) => onBooks.get(p.date) ?? 0,
              },
              {
                header: t("reports.columns.occupancyOnBooks"),
                value: (p) => share(onBooks.get(p.date) ?? 0, tenant.roomCount),
              },
              {
                header: t("reports.columns.forecastOccupancy"),
                value: (p) => p.forecast ?? p.occupancy,
              },
              {
                header: t("reports.columns.forecastLow"),
                value: (p) => p.lower,
              },
              {
                header: t("reports.columns.forecastHigh"),
                value: (p) => p.upper,
              },
              { header: t("reports.columns.forecastAdr"), value: (p) => p.adr },
              {
                header: t("reports.columns.forecastRoomRevenue"),
                value: (p) => p.rooms,
              },
            ],
            ahead
          )
          break
        }

        case "housekeeping": {
          type Row = {
            name: string
            shift: string
            tasks: HousekeepingTask[]
            pool?: boolean
          }
          const done = (row: Row) =>
            row.tasks.filter((task) => task.state === "completed").length
          const minutes = (row: Row) =>
            row.tasks.reduce((total, task) => total + task.minutes, 0)
          const attendants: Row[] = data.staff
            .filter((member) => member.department === "housekeeping")
            .map((member) => ({
              name: member.name[locale],
              shift: tk(`staff.shifts.${member.shift}`),
              tasks: data.housekeeping.filter(
                (task) => task.assigneeId === member.id
              ),
            }))
            .sort((a, b) => done(b) - done(a) || a.name.localeCompare(b.name))
          const pool: Row = {
            name: t("rooms.unassigned"),
            shift: "",
            tasks: data.housekeeping.filter((task) => !task.assigneeId),
            pool: true,
          }
          download<Row>(
            "housekeeping-productivity",
            [
              { header: t("reports.columns.attendant"), value: (r) => r.name },
              { header: t("staff.shift"), value: (r) => r.shift },
              {
                header: t("reports.columns.roomsAssigned"),
                value: (r) => r.tasks.length,
              },
              { header: t("rooms.completed"), value: done },
              {
                header: t("rooms.inProgress"),
                value: (r) =>
                  r.tasks.filter((task) => task.state === "inProgress").length,
              },
              { header: t("reports.columns.minutesAssigned"), value: minutes },
              {
                header: t("reports.columns.avgMinutes"),
                value: (r) =>
                  r.tasks.length > 0 ? round1(minutes(r) / r.tasks.length) : "",
              },
              {
                header: t("reports.columns.completion"),
                value: (r) =>
                  r.pool || r.tasks.length === 0
                    ? ""
                    : share(done(r), r.tasks.length),
              },
            ],
            [...attendants, pool]
          )
          break
        }

        case "satisfaction": {
          const from = daysAgo(30)
          const responses = data.reservations
            .filter(
              (r) =>
                r.status === "checkedOut" &&
                r.checkOut >= from &&
                r.checkOut <= today
            )
            .flatMap((stay) => {
              const rng = createRng(`satisfaction:${tenant.slug}:${stay.id}`)
              // Not every guest answers the survey.
              if (!rng.bool(0.42)) return []
              const mood = rng.around(4.2, 0.9, 1.5, 5)
              const score = () =>
                Math.round(Math.min(5, Math.max(1, mood + rng.around(0, 0.8))))
              const scores = {
                cleanliness: score(),
                service: score(),
                fnb: score(),
                value: score(),
              }
              return [
                {
                  stay,
                  ...scores,
                  overall: round1(
                    (scores.cleanliness +
                      scores.service +
                      scores.fnb +
                      scores.value) /
                      4
                  ),
                  recommend: Math.round(
                    Math.min(10, Math.max(0, mood * 2 + rng.around(0, 1.2)))
                  ),
                },
              ]
            })
            .sort((a, b) => b.stay.checkOut.localeCompare(a.stay.checkOut))
          download(
            "guest-satisfaction",
            [
              {
                header: t("bookings.checkOutDate"),
                value: (r) => r.stay.checkOut,
              },
              { header: t("bookings.bookingId"), value: (r) => r.stay.code },
              {
                header: t("common.guest"),
                value: (r) => guestName(r.stay.guestId),
              },
              {
                header: t("bookings.roomType"),
                value: (r) => roomType(r.stay),
              },
              {
                header: t("bookings.source"),
                value: (r) => SOURCE_LABEL[r.stay.source][locale],
              },
              { header: t("reports.columns.overall"), value: (r) => r.overall },
              {
                header: t("reports.columns.cleanliness"),
                value: (r) => r.cleanliness,
              },
              { header: t("reports.columns.service"), value: (r) => r.service },
              { header: t("dashboard.fnb"), value: (r) => r.fnb },
              { header: t("reports.columns.value"), value: (r) => r.value },
              {
                header: t("reports.columns.recommend"),
                value: (r) => r.recommend,
              },
            ],
            responses
          )
          break
        }

        case "segment": {
          const totals = new Map<
            CompanySegment,
            { accounts: number; nights: number; value: number }
          >()
          for (const company of data.companies) {
            const entry = totals.get(company.segment) ?? {
              accounts: 0,
              nights: 0,
              value: 0,
            }
            entry.accounts += 1
            entry.nights += company.roomNights
            entry.value += company.accountValue
            totals.set(company.segment, entry)
          }
          const all = [...totals.values()].reduce(
            (total, entry) => total + entry.value,
            0
          )
          const rows = [...totals.entries()]
            .map(([segment, entry]) => ({ segment, ...entry }))
            .sort((a, b) => b.value - a.value)
          download(
            "segment-performance",
            [
              {
                header: t("reports.columns.segment"),
                value: (r) => tk(`crm.segments.${r.segment}`),
              },
              {
                header: t("reports.columns.accounts"),
                value: (r) => r.accounts,
              },
              {
                header: t("reports.columns.roomNights"),
                value: (r) => r.nights,
              },
              {
                header: t("reports.columns.accountValue"),
                value: (r) => r.value,
              },
              {
                header: t("reports.columns.share"),
                value: (r) => share(r.value, all),
              },
              {
                header: t("reports.columns.valuePerNight"),
                value: (r) =>
                  r.nights > 0 ? Math.round(r.value / r.nights) : 0,
              },
            ],
            rows
          )
          break
        }

        case "vat": {
          const stays = invoiceStays(data.invoices, data.reservations)
          const rows = [...data.invoices]
            .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
            .map((invoice) => ({
              invoice,
              bill: invoiceBreakdown(
                invoice.amount,
                tenant.tax,
                stays.get(invoice.id)?.nights
              ),
            }))
          download(
            `${tenant.tax.name}-return`,
            [
              {
                header: t("reports.columns.taxPeriod"),
                value: (r) => r.invoice.issuedAt.slice(0, 7),
              },
              {
                header: t("finance.invoiceNumber"),
                value: (r) => r.invoice.number,
              },
              { header: t("finance.issued"), value: (r) => r.invoice.issuedAt },
              {
                header: t("common.guest"),
                value: (r) => guestName(r.invoice.guestId),
              },
              {
                header: t("crm.companies"),
                value: (r) =>
                  r.invoice.companyId
                    ? (lookups.company.get(r.invoice.companyId)?.name ?? "")
                    : "",
              },
              {
                header: t("reports.columns.nights"),
                value: (r) => r.bill.nights,
              },
              {
                header: t("reports.columns.roomCharges"),
                value: (r) => r.bill.subtotal,
              },
              {
                header: t("reports.columns.serviceCharge"),
                value: (r) => r.bill.serviceCharge,
              },
              {
                header: tk(`reports.columns.${tenant.tax.name}`),
                value: (r) => r.bill.tax,
              },
              { header: t("common.total"), value: (r) => r.bill.total },
              { header: t("finance.paid"), value: (r) => r.invoice.paid },
            ],
            rows
          )
          break
        }

        case "police": {
          const foreign = data.reservations
            .filter(
              (r) =>
                (r.status === "checkedIn" ||
                  (r.checkIn === today &&
                    (r.status === "confirmed" || r.status === "pending"))) &&
                lookups.guest.get(r.guestId)?.nationality.en !==
                  tenant.country.en
            )
            .sort(byRoom)
          download<Reservation>(
            "foreign-guest-register",
            [
              { header: t("common.guest"), value: (r) => guestName(r.guestId) },
              {
                header: t("reports.columns.nationality"),
                value: (r) =>
                  lookups.guest.get(r.guestId)?.nationality[locale] ?? "",
              },
              {
                header: t("common.phone"),
                value: (r) => lookups.guest.get(r.guestId)?.phone ?? "",
              },
              {
                header: t("common.email"),
                value: (r) => lookups.guest.get(r.guestId)?.email ?? "",
              },
              { header: t("common.room"), value: (r) => roomNumber(r.roomId) },
              { header: t("bookings.checkInDate"), value: (r) => r.checkIn },
              { header: t("bookings.checkOutDate"), value: (r) => r.checkOut },
              { header: t("bookings.bookingId"), value: (r) => r.code },
              {
                header: t("common.status"),
                value: (r) => tk(`bookings.${r.status}`),
              },
            ],
            foreign
          )
          break
        }

        case "arrivals": {
          const rows = [
            ...data.reservations
              .filter((r) => isLive(r) && r.checkIn === today)
              .sort(byRoom)
              .map((r) => ({ type: t("reports.columns.arrival"), r })),
            ...data.reservations
              .filter((r) => isLive(r) && r.checkOut === today)
              .sort(byRoom)
              .map((r) => ({ type: t("reports.columns.departure"), r })),
          ]
          download(
            "arrivals-departures",
            [
              { header: t("reports.columns.type"), value: (row) => row.type },
              { header: t("bookings.bookingId"), value: (row) => row.r.code },
              {
                header: t("common.guest"),
                value: (row) => guestName(row.r.guestId),
              },
              {
                header: t("common.room"),
                value: (row) => roomNumber(row.r.roomId),
              },
              {
                header: t("bookings.roomType"),
                value: (row) => roomType(row.r),
              },
              {
                header: t("bookings.checkInDate"),
                value: (row) => row.r.checkIn,
              },
              {
                header: t("bookings.checkOutDate"),
                value: (row) => row.r.checkOut,
              },
              {
                header: t("reports.columns.nights"),
                value: (row) => row.r.nights,
              },
              { header: t("common.adults"), value: (row) => row.r.adults },
              { header: t("common.children"), value: (row) => row.r.children },
              {
                header: t("common.status"),
                value: (row) => tk(`bookings.${row.r.status}`),
              },
              {
                header: t("reports.columns.balance"),
                value: (row) => row.r.total - row.r.paid,
              },
            ],
            rows
          )
          break
        }

        case "fnbCost": {
          // Four complete weeks, up to yesterday.
          const from = daysAgo(28)
          const rows = data.series
            .filter((p) => p.date >= from && p.date <= yesterday)
            .map((p) => {
              const rng = createRng(`fnb-cost:${tenant.slug}:${p.date}`)
              const cost = Math.round(
                p.fnb * rng.around(0.31, 0.03, 0.25, 0.38)
              )
              return { date: p.date, revenue: p.fnb, cost }
            })
          download(
            "fnb-cost-of-sales",
            [
              { header: t("common.date"), value: (r) => r.date },
              {
                header: t("reports.columns.fnbRevenue"),
                value: (r) => r.revenue,
              },
              {
                header: t("reports.columns.costOfSales"),
                value: (r) => r.cost,
              },
              {
                header: t("reports.columns.costPct"),
                value: (r) => share(r.cost, r.revenue),
              },
              {
                header: t("reports.columns.grossProfit"),
                value: (r) => r.revenue - r.cost,
              },
            ],
            rows
          )
          break
        }

        case "attendance": {
          const from = daysAgo(6)
          const records = data.attendance.filter(
            (record) => record.date >= from && record.date <= today
          )
          const rows = data.staff.map((member) => {
            const own = records.filter((record) => record.staffId === member.id)
            const counted = (state: string) =>
              own.filter((record) => record.state === state).length
            return {
              member,
              present: counted("present"),
              late: counted("late"),
              absent: counted("absent"),
              onLeave: counted("onLeave"),
              hours: round1(own.reduce((total, r) => total + r.hours, 0)),
              days: own.length,
            }
          })
          download(
            "attendance-summary",
            [
              { header: t("common.name"), value: (r) => r.member.name[locale] },
              {
                header: t("staff.department"),
                value: (r) => tk(`staff.departments.${r.member.department}`),
              },
              { header: t("staff.present"), value: (r) => r.present },
              { header: t("staff.late"), value: (r) => r.late },
              { header: t("staff.absent"), value: (r) => r.absent },
              { header: t("staff.onLeave"), value: (r) => r.onLeave },
              {
                header: t("reports.columns.hoursWorked"),
                value: (r) => r.hours,
              },
              {
                header: t("reports.columns.attendancePct"),
                value: (r) => share(r.present + r.late, r.days),
              },
            ],
            rows
          )
          break
        }

        case "loyalty": {
          const rows = data.guests
            .map((guest) => {
              const rng = createRng(`loyalty:${tenant.slug}:${guest.id}`)
              const roll = rng.next()
              const index = TIER_ORDER.indexOf(guest.tier)
              const previous =
                roll < 0.1 && index > 0
                  ? TIER_ORDER[index - 1]
                  : roll > 0.96 && index < TIER_ORDER.length - 1
                    ? TIER_ORDER[index + 1]
                    : guest.tier
              const movement =
                previous === guest.tier
                  ? "unchanged"
                  : TIER_ORDER.indexOf(previous) < index
                    ? "upgraded"
                    : "downgraded"
              return { guest, previous, movement }
            })
            .sort(
              (a, b) =>
                MOVEMENT_ORDER.indexOf(a.movement) -
                  MOVEMENT_ORDER.indexOf(b.movement) ||
                b.guest.lifetimeValue - a.guest.lifetimeValue
            )
          download(
            "loyalty-tier-movement",
            [
              { header: t("common.guest"), value: (r) => r.guest.name[locale] },
              {
                header: t("reports.columns.previousTier"),
                value: (r) => tk(`crm.tiers.${r.previous}`),
              },
              {
                header: t("reports.columns.currentTier"),
                value: (r) => tk(`crm.tiers.${r.guest.tier}`),
              },
              {
                header: t("reports.columns.movement"),
                value: (r) => tk(`reports.columns.${r.movement}`),
              },
              {
                header: t("reports.columns.stays"),
                value: (r) => r.guest.stays,
              },
              {
                header: t("reports.columns.lifetimeValue"),
                value: (r) => r.guest.lifetimeValue,
              },
              { header: t("common.email"), value: (r) => r.guest.email },
            ],
            rows
          )
          break
        }
      }

      toast.success(
        t("reports.downloaded", {
          name: reportText(report, tenant).name[locale],
        }),
        {
          description: tk(`reports.rows.${count === 1 ? "one" : "other"}`, {
            count: num(count),
          }),
        }
      )
    },
    [data, lookups, tenant, t, tk, locale, num]
  )
}

const MOVEMENT_ORDER = ["upgraded", "downgraded", "unchanged"]
