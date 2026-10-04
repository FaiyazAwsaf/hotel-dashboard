import type { Invoice, Reservation, TaxRules } from "@/lib/types"

/**
 * A hotel bill's make-up. Rates are quoted inclusive ("net"), so an invoice's
 * amount already holds the service charge and the sales tax, the tax being
 * charged on the room rate plus the service charge — 10% + 15% VAT in
 * Bangladesh comes to 26.5% on top of the room rate.
 */
export type InvoiceBreakdown = {
  nights: number
  /** Room rate per night before service charge and tax. */
  rate: number
  /** `rate × nights`. */
  subtotal: number
  serviceCharge: number
  tax: number
  total: number
}

export function invoiceBreakdown(
  amount: number,
  rules: TaxRules,
  nights = 1
): InvoiceBreakdown {
  const factor = (1 + rules.serviceCharge) * (1 + rules.rate)
  const count = Math.max(1, nights)
  const rate = Math.round(amount / count / factor)
  const subtotal = rate * count
  const serviceCharge = Math.round(subtotal * rules.serviceCharge)
  // The tax takes up the rounding, so the lines always add up to the amount.
  return {
    nights: count,
    rate,
    subtotal,
    serviceCharge,
    tax: amount - subtotal - serviceCharge,
    total: amount,
  }
}

/** "15%" as written on a bill. */
export function ratePercent(rate: number) {
  return Math.round(rate * 1000) / 10
}

/**
 * Invoices are raised at check-out for the stay's total, so the stay they
 * bill is the checked-out reservation with the same guest, check-out day and
 * total. Returns invoice id → reservation.
 */
export function invoiceStays(
  invoices: readonly Invoice[],
  reservations: readonly Reservation[]
) {
  const key = (guestId: string, day: string, amount: number) =>
    `${guestId}|${day}|${amount}`
  const byKey = new Map<string, Reservation>()
  for (const reservation of reservations) {
    if (reservation.status !== "checkedOut") continue
    const id = key(reservation.guestId, reservation.checkOut, reservation.total)
    if (!byKey.has(id)) byKey.set(id, reservation)
  }
  const stays = new Map<string, Reservation>()
  for (const invoice of invoices) {
    const stay = byKey.get(
      key(invoice.guestId, invoice.issuedAt, invoice.amount)
    )
    if (stay) stays.set(invoice.id, stay)
  }
  return stays
}
