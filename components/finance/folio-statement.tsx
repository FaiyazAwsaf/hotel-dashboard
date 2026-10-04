"use client"

import * as React from "react"

import { useDataset, useLookups, useMoney } from "@/lib/data"
import { useLocale } from "@/lib/i18n/provider"
import { PrintDocument, usePrint } from "@/lib/print"
import type { Folio } from "@/lib/types"

/** Dates on documents carry the year. */
const FULL_DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
}

/** A folio printed as the guest's statement of account. */
function FolioStatement({ folio }: { folio: Folio }) {
  const data = useDataset()
  const lookups = useLookups()
  const money = useMoney()
  const { t, locale, date } = useLocale()

  const guest = lookups.guest.get(folio.guestId)
  const stay = data.reservations.find((r) => r.id === folio.reservationId)
  const room = stay ? lookups.room.get(stay.roomId) : undefined
  const charges = folio.lines.reduce((sum, line) => sum + line.amount, 0)
  const credits = charges - folio.balance

  return (
    <div className="flex flex-col gap-5 text-xs">
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <div className="micro pb-1">{t("common.guest")}</div>
          <div className="font-medium">{guest?.name[locale] ?? "—"}</div>
          {guest ? (
            <div className="text-muted-foreground">
              <div>{guest.email}</div>
              <div className="nums">{guest.phone}</div>
            </div>
          ) : null}
        </div>
        {stay ? (
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-0.5">
            <dt className="text-muted-foreground">{t("bookings.bookingId")}</dt>
            <dd className="nums text-right font-medium">{stay.code}</dd>
            <dt className="text-muted-foreground">{t("common.room")}</dt>
            <dd className="text-right">
              {room ? `${room.number} · ` : ""}
              {t(`rooms.types.${stay.roomTypeId}` as never)}
            </dd>
            <dt className="text-muted-foreground">
              {t("bookings.checkInDate")}
            </dt>
            <dd className="nums text-right">{date(stay.checkIn, FULL_DATE)}</dd>
            <dt className="text-muted-foreground">
              {t("bookings.checkOutDate")}
            </dt>
            <dd className="nums text-right">
              {date(stay.checkOut, FULL_DATE)}
            </dd>
          </dl>
        ) : null}
      </div>

      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="micro border-b border-[var(--hairline)] py-1.5 text-left">
              {t("common.date")}
            </th>
            <th className="micro border-b border-[var(--hairline)] py-1.5 text-left">
              {t("finance.invoice.description")}
            </th>
            <th className="micro border-b border-[var(--hairline)] py-1.5 text-left">
              {t("finance.byDepartment")}
            </th>
            <th className="micro border-b border-[var(--hairline)] py-1.5 text-right">
              {t("common.amount")}
            </th>
          </tr>
        </thead>
        <tbody>
          {folio.lines.map((line) => (
            <tr key={line.id}>
              <td className="nums border-b border-[var(--hairline)] py-1.5 text-muted-foreground">
                {date(line.at, FULL_DATE)}
              </td>
              <td className="border-b border-[var(--hairline)] py-1.5">
                {line.description[locale]}
              </td>
              <td className="border-b border-[var(--hairline)] py-1.5">
                {t(`dashboard.${line.department}` as never)}
              </td>
              <td className="nums border-b border-[var(--hairline)] py-1.5 text-right">
                {money.format(line.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto flex w-full max-w-64 flex-col gap-1">
        <div className="flex justify-between gap-3">
          <span>{t("finance.charges")}</span>
          <span className="nums">{money.format(charges)}</span>
        </div>
        <div className="flex justify-between gap-3 text-muted-foreground">
          <span>{t("finance.credits")}</span>
          <span className="nums">−{money.format(Math.max(0, credits))}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3 border-t border-[var(--hairline)] pt-1.5 font-medium">
          <span>{t("frontDesk.balance")}</span>
          <span className="nums">{money.format(folio.balance)}</span>
        </div>
      </div>

      <p className="text-[0.625rem] text-muted-foreground">
        {t("finance.folio.statementNote")}
      </p>
    </div>
  )
}

/** Prints a folio as the guest's statement, on A4. */
export function usePrintFolio() {
  const print = usePrint()
  const { t } = useLocale()

  return React.useCallback(
    (folio: Folio) =>
      print(
        <PrintDocument
          title={t("finance.folio.statement")}
          reference={folio.number}
        >
          <FolioStatement folio={folio} />
        </PrintDocument>,
        {
          title: `${t("finance.folio.statement")} ${folio.number}`,
          size: "A4",
        }
      ),
    [print, t]
  )
}
