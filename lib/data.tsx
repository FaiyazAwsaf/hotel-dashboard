"use client"

import * as React from "react"

import { generateDataset } from "@/lib/mock/generate"
import {
  applyEdits,
  useSession,
  type Collection,
  type RecordOf,
} from "@/lib/session"
import { useUi } from "@/lib/store"
import { getTenant, TENANTS } from "@/lib/tenants"
import type { Dataset, Tenant } from "@/lib/types"
import { useLocale } from "@/lib/i18n/provider"
import { formatCompactCurrency, formatCurrency } from "@/lib/i18n/format"

/** Datasets are pure functions of the tenant slug — build each one once. */
const cache = new Map<string, Dataset>()

function datasetFor(tenant: Tenant) {
  const existing = cache.get(tenant.id)
  if (existing) return existing
  const built = generateDataset(tenant)
  cache.set(tenant.id, built)
  return built
}

const DataContext = React.createContext<Dataset | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const tenant = getTenant(useUi((state) => state.tenantId))
  const base = React.useMemo(() => datasetFor(tenant), [tenant])
  // Session edits are layered on top, so whatever the demo user adds or
  // changes reaches every screen that reads the collection.
  const edits = useSession((state) => state.edits[tenant.id])
  const dataset = React.useMemo(() => applyEdits(base, edits), [base, edits])
  return <DataContext.Provider value={dataset}>{children}</DataContext.Provider>
}

export function useDataset() {
  const dataset = React.useContext(DataContext)
  if (!dataset) throw new Error("useDataset must be used inside <DataProvider>")
  return dataset
}

export function useTenant() {
  return useDataset().tenant
}

export function useTenants() {
  const tenantId = useUi((state) => state.tenantId)
  const setTenantId = useUi((state) => state.setTenantId)
  return { tenants: TENANTS, tenantId, setTenantId }
}

/**
 * Create and change records for the active property. Edits last for the
 * session and show up everywhere through `useDataset()` — see `lib/session.ts`.
 * Call these from event handlers, never during render.
 */
export function useDataEdits() {
  const tenantId = useTenant().id
  const add = useSession((state) => state.add)
  const update = useSession((state) => state.update)
  const nextSequence = useSession((state) => state.nextSequence)

  return React.useMemo(
    () => ({
      /** Adds a record to the top of its collection. */
      add: <K extends Collection>(collection: K, record: RecordOf<K>) =>
        add(tenantId, collection, record),
      /** Merges `changes` into one record, or into each of several. */
      update: <K extends Collection>(
        collection: K,
        ids: string | readonly string[],
        changes: Partial<RecordOf<K>>
      ) =>
        update(
          tenantId,
          collection,
          typeof ids === "string" ? [ids] : ids,
          changes
        ),
      /** An id for a record created this session, e.g. `visitor_s3`. */
      newId: (prefix: string) => `${prefix}_s${nextSequence()}`,
    }),
    [tenantId, add, update, nextSequence]
  )
}

/** Currency formatting bound to both the active locale and the active property. */
export function useMoney() {
  const { locale } = useLocale()
  const tenant = useTenant()
  return React.useMemo(
    () => ({
      currency: tenant.currency,
      symbol: tenant.currency === "USD" ? "$" : "৳",
      format: (value: number, options?: Intl.NumberFormatOptions) =>
        formatCurrency(value, locale, tenant.currency, options),
      compact: (value: number) =>
        formatCompactCurrency(value, locale, tenant.currency),
    }),
    [locale, tenant.currency]
  )
}

/* ------------------------------------------------------------------ *
 * Lookup helpers — small maps built once per dataset, used everywhere
 * ------------------------------------------------------------------ */

export function useLookups() {
  const data = useDataset()
  return React.useMemo(
    () => ({
      guest: new Map(data.guests.map((g) => [g.id, g])),
      room: new Map(data.rooms.map((r) => [r.id, r])),
      roomType: new Map(data.roomTypes.map((t) => [t.id, t])),
      staff: new Map(data.staff.map((s) => [s.id, s])),
      company: new Map(data.companies.map((c) => [c.id, c])),
      contact: new Map(data.contacts.map((c) => [c.id, c])),
      supplier: new Map(data.suppliers.map((s) => [s.id, s])),
      visitor: new Map(data.visitors.map((v) => [v.id, v])),
      vehicle: new Map(data.vehicles.map((v) => [v.id, v])),
      camera: new Map(data.cameras.map((c) => [c.id, c])),
      invoice: new Map(data.invoices.map((i) => [i.id, i])),
    }),
    [data]
  )
}
