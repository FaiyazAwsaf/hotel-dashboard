"use client"

import * as React from "react"
import { Printer, Send, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { FormSheetField, FormSheetSelect } from "@/components/motion/form-sheet"
import { SendSheet } from "@/components/motion/send-sheet"
import { StatusTag } from "@/components/motion/status-tag"
import { cn } from "@/lib/utils"
import { useDataset, useLookups, useMoney, useTenant } from "@/lib/data"
import { invoiceBreakdown, invoiceStays, ratePercent } from "@/lib/finance"
import { useLocale } from "@/lib/i18n/provider"
import { PrintDocument, usePrint } from "@/lib/print"
import type { Invoice, InvoiceStatus, TagHue } from "@/lib/types"

/** Dates on documents carry the year. */
const FULL_DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
}

/** Dates written out in a message. */
const LONG_DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
}

export const INVOICE_STATUS_HUE: Record<InvoiceStatus, TagHue> = {
  paid: "green",
  due: "blue",
  overdue: "rose",
  partiallyPaid: "amber",
}

/**
 * Everything an invoice shows: who it bills, the stay it bills for, the
 * charges with service charge and tax, and the payments against it.
 */
function useInvoiceDetails() {
  const data = useDataset()
  const lookups = useLookups()
  const tenant = useTenant()

  const stays = React.useMemo(
    () => invoiceStays(data.invoices, data.reservations),
    [data.invoices, data.reservations]
  )
  const paymentsByInvoice = React.useMemo(() => {
    const map = new Map<string, typeof data.payments>()
    for (const payment of data.payments) {
      map.set(payment.invoiceId, [
        ...(map.get(payment.invoiceId) ?? []),
        payment,
      ])
    }
    return map
  }, [data.payments])

  return React.useCallback(
    (invoice: Invoice) => {
      const stay = stays.get(invoice.id)
      return {
        guest: lookups.guest.get(invoice.guestId),
        company: invoice.companyId
          ? lookups.company.get(invoice.companyId)
          : undefined,
        stay,
        room: stay ? lookups.room.get(stay.roomId) : undefined,
        breakdown: invoiceBreakdown(invoice.amount, tenant.tax, stay?.nights),
        payments: paymentsByInvoice.get(invoice.id) ?? [],
        balance: invoice.amount - invoice.paid,
      }
    },
    [stays, lookups, tenant.tax, paymentsByInvoice]
  )
}

/** The invoice itself, on screen and on paper. */
export function InvoiceBody({ invoice }: { invoice: Invoice }) {
  const details = useInvoiceDetails()(invoice)
  const tenant = useTenant()
  const money = useMoney()
  const { t, tk, locale, num, date, pct } = useLocale()
  const { guest, company, stay, room, breakdown, payments, balance } = details

  const roomType = stay
    ? t(`rooms.types.${stay.roomTypeId}` as never)
    : undefined
  const guests = stay
    ? [
        tk(`finance.invoice.adults.${stay.adults === 1 ? "one" : "other"}`, {
          count: num(stay.adults),
        }),
        stay.children > 0
          ? tk(
              `finance.invoice.children.${stay.children === 1 ? "one" : "other"}`,
              { count: num(stay.children) }
            )
          : null,
      ]
        .filter(Boolean)
        .join(", ")
    : undefined

  return (
    <div className="flex flex-col gap-5 text-xs">
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <div className="micro pb-1">{t("finance.invoice.billTo")}</div>
          <div className="font-medium">{guest?.name[locale] ?? "—"}</div>
          {company ? <div>{company.name}</div> : null}
          {guest ? (
            <div className="text-muted-foreground">
              <div className="truncate">{guest.email}</div>
              <div className="nums">{guest.phone}</div>
            </div>
          ) : null}
        </div>
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-0.5">
          <dt className="text-muted-foreground">
            {t("finance.invoiceNumber")}
          </dt>
          <dd className="nums text-right font-medium">{invoice.number}</dd>
          <dt className="text-muted-foreground">{t("finance.issued")}</dt>
          <dd className="nums text-right">
            {date(invoice.issuedAt, FULL_DATE)}
          </dd>
          <dt className="text-muted-foreground">{t("finance.due")}</dt>
          <dd className="nums text-right">{date(invoice.dueAt, FULL_DATE)}</dd>
          <dt className="text-muted-foreground">{t("common.status")}</dt>
          <dd className="text-right">
            <StatusTag hue={INVOICE_STATUS_HUE[invoice.status]} dot>
              {t(`finance.${invoice.status}` as never)}
            </StatusTag>
          </dd>
        </dl>
      </div>

      {stay ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-3 py-2.5 sm:grid-cols-4">
          <Fact label={t("bookings.bookingId")} value={stay.code} />
          <Fact
            label={t("common.room")}
            value={room ? `${room.number} · ${roomType}` : (roomType ?? "—")}
          />
          <Fact
            label={t("finance.invoice.stay")}
            value={`${date(stay.checkIn, { day: "numeric", month: "short" })} – ${date(stay.checkOut, FULL_DATE)}`}
          />
          <Fact label={t("common.guests")} value={guests ?? "—"} />
        </div>
      ) : null}

      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="micro border-b border-[var(--hairline)] py-1.5 text-left">
              {t("finance.invoice.description")}
            </th>
            <th className="micro border-b border-[var(--hairline)] py-1.5 text-right">
              {t("common.nights")}
            </th>
            <th className="micro border-b border-[var(--hairline)] py-1.5 text-right">
              {t("finance.invoice.rate")}
            </th>
            <th className="micro border-b border-[var(--hairline)] py-1.5 text-right">
              {t("common.amount")}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b border-[var(--hairline)] py-2">
              {roomType
                ? t("finance.invoice.roomLine", { type: roomType })
                : t("finance.invoice.accommodation")}
            </td>
            <td className="nums border-b border-[var(--hairline)] py-2 text-right">
              {num(breakdown.nights)}
            </td>
            <td className="nums border-b border-[var(--hairline)] py-2 text-right">
              {money.format(breakdown.rate)}
            </td>
            <td className="nums border-b border-[var(--hairline)] py-2 text-right">
              {money.format(breakdown.subtotal)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="ml-auto flex w-full max-w-64 flex-col gap-1">
        <Line
          label={t("common.subtotal")}
          value={money.format(breakdown.subtotal)}
        />
        <Line
          label={t("finance.invoice.serviceCharge", {
            rate: pct(ratePercent(tenant.tax.serviceCharge), 0),
          })}
          value={money.format(breakdown.serviceCharge)}
        />
        <Line
          label={tk(`finance.invoice.${tenant.tax.name}`, {
            rate: pct(ratePercent(tenant.tax.rate), 0),
          })}
          value={money.format(breakdown.tax)}
        />
        <Line
          label={t("common.total")}
          value={money.format(breakdown.total)}
          strong
          rule
        />
        <Line
          label={t("finance.paid")}
          value={`−${money.format(invoice.paid)}`}
          muted
        />
        <Line
          label={t("finance.invoice.balanceDue")}
          value={money.format(balance)}
          strong
        />
      </div>

      <div>
        <div className="micro pb-1.5">{t("finance.payments")}</div>
        {payments.length > 0 ? (
          <div className="flex flex-col">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center gap-3 border-b border-[var(--hairline)] py-1.5 last:border-0"
              >
                <span className="nums w-24 shrink-0 text-muted-foreground">
                  {date(payment.at, FULL_DATE)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {t(`finance.methods.${payment.method}` as never)}
                  <span className="nums text-muted-foreground">
                    {" "}
                    · {payment.reference}
                  </span>
                </span>
                <span className="nums">{money.format(payment.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {t("finance.invoice.noPayments")}
          </p>
        )}
      </div>

      <p className="text-[0.625rem] text-muted-foreground">
        {tk(`finance.invoice.taxNote.${tenant.tax.name}`, {
          service: pct(ratePercent(tenant.tax.serviceCharge), 0),
          rate: pct(ratePercent(tenant.tax.rate), 0),
        })}
      </p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.625rem] text-muted-foreground">{label}</div>
      <div className="nums truncate font-medium">{value}</div>
    </div>
  )
}

function Line({
  label,
  value,
  strong,
  muted,
  rule,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
  rule?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3",
        muted && "text-muted-foreground",
        strong && "font-medium",
        rule && "mt-1 border-t border-[var(--hairline)] pt-1.5"
      )}
    >
      <span>{label}</span>
      <span className="nums">{value}</span>
    </div>
  )
}

/** Prints invoices on A4, one per page. */
export function usePrintInvoices() {
  const print = usePrint()
  const { t } = useLocale()

  return React.useCallback(
    (invoices: Invoice[]) => {
      if (invoices.length === 0) return
      print(
        <>
          {invoices.map((invoice) => (
            <div key={invoice.id} className="not-last:break-after-page">
              <PrintDocument
                title={t("finance.invoice.title")}
                reference={invoice.number}
              >
                <InvoiceBody invoice={invoice} />
              </PrintDocument>
            </div>
          ))}
        </>,
        {
          title:
            invoices.length === 1
              ? `${t("finance.invoice.title")} ${invoices[0].number}`
              : t("finance.invoices"),
          size: "A4",
        }
      )
    },
    [print, t]
  )
}

/** An invoice opened from the list, with Print and Share. */
export function InvoiceSheet({
  invoice,
  onClose,
}: {
  invoice: Invoice | null
  onClose: () => void
}) {
  const { t, locale } = useLocale()
  const lookups = useLookups()
  const printInvoices = usePrintInvoices()
  const [sharing, setSharing] = React.useState(false)
  // Keep the last invoice on screen while the sheet animates closed.
  const [shown, setShown] = React.useState(invoice)
  if (invoice && invoice !== shown) setShown(invoice)

  const guest = shown ? lookups.guest.get(shown.guestId) : undefined

  return (
    <>
      <Sheet
        open={invoice !== null}
        onOpenChange={(open) => !open && onClose()}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        >
          <div className="flex items-start gap-3 border-b border-[var(--hairline)] px-5 py-4">
            <div className="min-w-0 flex-1">
              <SheetTitle>
                {t("finance.invoice.title")}{" "}
                <span className="nums">{shown?.number}</span>
              </SheetTitle>
              <SheetDescription className="mt-0.5">
                {guest?.name[locale]}
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={t("common.close")}
            >
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {shown ? <InvoiceBody invoice={shown} /> : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--hairline)] px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSharing(true)}
            >
              <Send />
              {t("common.share")}
            </Button>
            <Button size="sm" onClick={() => shown && printInvoices([shown])}>
              <Printer />
              {t("finance.invoice.print")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <ShareInvoiceSheet
        open={sharing}
        onOpenChange={setSharing}
        invoice={shown}
      />
    </>
  )
}

/**
 * Send an invoice to the guest. Given an `invoice`, it sends that one;
 * without, it starts with a picker of every invoice, preset to `preselect`.
 */
export function ShareInvoiceSheet({
  open,
  onOpenChange,
  invoice,
  preselect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice?: Invoice | null
  preselect?: string
}) {
  const data = useDataset()
  const lookups = useLookups()
  const tenant = useTenant()
  const money = useMoney()
  const details = useInvoiceDetails()
  const { t, locale, date } = useLocale()
  const pickable = invoice === undefined
  const [pickedId, setPickedId] = React.useState(preselect)

  // Each open starts from the invoice it was opened for.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setPickedId(preselect)
  }

  const current = pickable
    ? data.invoices.find((entry) => entry.id === pickedId)
    : invoice
  const options = React.useMemo(
    () =>
      pickable
        ? Object.fromEntries(
            data.invoices.map((entry) => [
              entry.id,
              `${entry.number} · ${lookups.guest.get(entry.guestId)?.name[locale] ?? "—"}`,
            ])
          )
        : {},
    [pickable, data.invoices, lookups, locale]
  )

  const guest = current ? lookups.guest.get(current.guestId) : undefined
  const property = tenant.name[locale]
  const message = React.useMemo(() => {
    if (!current) return ""
    const { stay, balance } = details(current)
    return [
      t("share.invoice.greeting", { name: guest?.name[locale] ?? "" }),
      "",
      stay
        ? t("share.invoice.body", {
            number: current.number,
            property,
            from: date(stay.checkIn, LONG_DATE),
            to: date(stay.checkOut, LONG_DATE),
          })
        : t("share.invoice.bodyNoStay", { number: current.number, property }),
      "",
      t("share.invoice.amount", { amount: money.format(current.amount) }),
      balance > 0
        ? t("share.invoice.balance", {
            amount: money.format(balance),
            date: date(current.dueAt, LONG_DATE),
          })
        : t("share.invoice.paidInFull"),
      "",
      t("share.invoice.closing"),
      property,
    ].join("\n")
  }, [current, details, guest, locale, property, money, date, t])

  return (
    <SendSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("share.invoice.title")}
      description={t("share.invoice.hint")}
      attachment={current ? `${current.number}.pdf` : undefined}
      recipient={{ email: guest?.email, phone: guest?.phone }}
      subject={
        current
          ? t("share.invoice.subject", { number: current.number, property })
          : undefined
      }
      message={message}
      resetKey={current?.id}
      sentMessage={(to) =>
        t("share.invoice.sent", { number: current?.number ?? "", to })
      }
    >
      {pickable ? (
        <FormSheetField
          name="invoice"
          label={t("finance.invoiceNumber")}
          required
        >
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={options}
              defaultValue={preselect}
              onChange={setPickedId}
            />
          )}
        </FormSheetField>
      ) : null}
    </SendSheet>
  )
}
