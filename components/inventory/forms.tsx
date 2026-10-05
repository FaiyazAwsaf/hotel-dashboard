"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FormSheet,
  FormSheetDate,
  FormSheetField,
  FormSheetSelect,
  type FormErrors,
  type FormValues,
} from "@/components/motion/form-sheet"
import { useDataset, useMoney } from "@/lib/data"
import { addDays, demoToday, isoDay } from "@/lib/demo-time"
import { useLocale } from "@/lib/i18n/provider"
import { useInventoryActions } from "@/lib/inventory-actions"
import { INVENTORY_ITEMS } from "@/lib/mock/pools"
import { isPhone, parseNumber } from "@/lib/validate"
import type { Bilingual } from "@/lib/types"

/** One of each, in pool order. */
function distinct(entries: Bilingual[]) {
  const seen = new Map<string, Bilingual>()
  for (const entry of entries)
    if (!seen.has(entry.en)) seen.set(entry.en, entry)
  return [...seen.values()]
}

const CATEGORIES = distinct(INVENTORY_ITEMS.map((item) => item.category))
const UNITS = distinct(INVENTORY_ITEMS.map((item) => item.unit))

const items = (pool: Bilingual[], locale: "en" | "bn") =>
  Object.fromEntries(pool.map((entry) => [entry.en, entry[locale]]))

/** Suppliers by name, for pickers. */
function useSupplierItems() {
  const data = useDataset()
  const { locale } = useLocale()
  return React.useMemo(
    () =>
      Object.fromEntries(
        data.suppliers
          .slice()
          .sort((a, b) => a.name[locale].localeCompare(b.name[locale]))
          .map((supplier) => [supplier.id, supplier.name[locale]])
      ),
    [data.suppliers, locale]
  )
}

/** A whole number of at least `min`, or null. */
function wholeNumber(value: string, min: number) {
  const number = parseNumber(value)
  return number !== null && Number.isInteger(number) && number >= min
    ? number
    : null
}

/* ------------------------------------------------------------------ *
 * Stock → + New
 * ------------------------------------------------------------------ */

export function NewStockItemButton() {
  const data = useDataset()
  const actions = useInventoryActions()
  const suppliers = useSupplierItems()
  const money = useMoney()
  const { t, locale, num } = useLocale()
  const [open, setOpen] = React.useState(false)

  const submit = (values: FormValues): FormErrors | void => {
    const errors: FormErrors = {}
    const taken = data.inventory.find(
      (item) =>
        item.name.en.toLowerCase() === values.name.toLowerCase() ||
        item.name.bn === values.name
    )
    if (taken) {
      errors.name = t("forms.alreadyExists", { name: taken.name[locale] })
    }
    const onHand = wholeNumber(values.onHand, 0)
    const reorderPoint = wholeNumber(values.reorderPoint, 1)
    const unitCost = parseNumber(values.unitCost)
    if (onHand === null) errors.onHand = t("forms.wholeNumber", { min: num(0) })
    if (reorderPoint === null) {
      errors.reorderPoint = t("forms.wholeNumber", { min: num(1) })
    }
    if (unitCost === null || unitCost <= 0) {
      errors.unitCost = t("forms.positiveNumber")
    }
    if (
      Object.keys(errors).length > 0 ||
      onHand === null ||
      reorderPoint === null ||
      unitCost === null
    ) {
      return errors
    }

    const item = actions.addItem({
      name: values.name,
      category:
        CATEGORIES.find((entry) => entry.en === values.category) ??
        CATEGORIES[0],
      unit: UNITS.find((entry) => entry.en === values.unit) ?? UNITS[0],
      onHand,
      reorderPoint,
      supplierId: values.supplier,
      unitCost,
    })
    toast.success(
      t("inventory.forms.itemAdded", { name: item.name[locale], sku: item.sku })
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        {t("common.new")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={t("inventory.forms.itemTitle")}
        description={t("inventory.forms.itemHint")}
        submitLabel={t("inventory.forms.addItem")}
        onSubmit={submit}
      >
        <FormSheetField name="name" label={t("common.name")} required>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField
            name="category"
            label={t("inventory.category")}
            required
          >
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={items(CATEGORIES, locale)}
              />
            )}
          </FormSheetField>
          <FormSheetField
            name="unit"
            label={t("inventory.forms.unit")}
            required
          >
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={items(UNITS, locale)}
                defaultValue="pcs"
              />
            )}
          </FormSheetField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField name="onHand" label={t("inventory.onHand")} required>
            {(field) => (
              <Input {...field} inputMode="numeric" autoComplete="off" />
            )}
          </FormSheetField>
          <FormSheetField
            name="reorderPoint"
            label={t("inventory.reorderPoint")}
            required
            description={t("inventory.forms.reorderPointHint")}
          >
            {(field) => (
              <Input {...field} inputMode="numeric" autoComplete="off" />
            )}
          </FormSheetField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField
            name="supplier"
            label={t("inventory.supplier")}
            required
          >
            {(field, controls) => (
              <FormSheetSelect
                field={field}
                controls={controls}
                items={suppliers}
              />
            )}
          </FormSheetField>
          <FormSheetField
            name="unitCost"
            label={`${t("inventory.unitCost")} (${money.symbol})`}
            required
          >
            {(field) => (
              <Input {...field} inputMode="decimal" autoComplete="off" />
            )}
          </FormSheetField>
        </div>
      </FormSheet>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Suppliers → + New
 * ------------------------------------------------------------------ */

export function NewSupplierButton() {
  const data = useDataset()
  const actions = useInventoryActions()
  const { t, locale, num } = useLocale()
  const [open, setOpen] = React.useState(false)

  const submit = (values: FormValues): FormErrors | void => {
    const errors: FormErrors = {}
    const taken = data.suppliers.find(
      (supplier) =>
        supplier.name.en.toLowerCase() === values.name.toLowerCase() ||
        supplier.name.bn === values.name
    )
    if (taken) {
      errors.name = t("forms.alreadyExists", { name: taken.name[locale] })
    }
    if (!isPhone(values.phone)) errors.phone = t("share.phoneInvalid")
    const leadTime = wholeNumber(values.leadTime, 1)
    if (leadTime === null || leadTime > 90) {
      errors.leadTime = t("forms.between", { min: num(1), max: num(90) })
    }
    if (Object.keys(errors).length > 0 || leadTime === null) return errors

    const supplier = actions.addSupplier({
      name: values.name,
      category:
        CATEGORIES.find((entry) => entry.en === values.category) ??
        CATEGORIES[0],
      contact: values.contact,
      phone: values.phone,
      leadTimeDays: leadTime,
    })
    toast.success(
      t("inventory.forms.supplierAdded", { name: supplier.name[locale] })
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        {t("common.new")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={t("inventory.forms.supplierTitle")}
        description={t("inventory.forms.supplierHint")}
        submitLabel={t("inventory.forms.addSupplier")}
        onSubmit={submit}
      >
        <FormSheetField name="name" label={t("common.name")} required>
          {(field) => <Input {...field} autoComplete="off" />}
        </FormSheetField>
        <FormSheetField
          name="category"
          label={t("inventory.category")}
          required
        >
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={items(CATEGORIES, locale)}
            />
          )}
        </FormSheetField>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField
            name="contact"
            label={t("inventory.forms.contactPerson")}
            required
          >
            {(field) => <Input {...field} autoComplete="off" />}
          </FormSheetField>
          <FormSheetField name="phone" label={t("common.phone")} required>
            {(field) => <Input {...field} type="tel" autoComplete="off" />}
          </FormSheetField>
        </div>
        <FormSheetField
          name="leadTime"
          label={t("inventory.forms.leadTimeDays")}
          required
          description={t("inventory.forms.leadTimeHint")}
        >
          {(field) => (
            <Input
              {...field}
              inputMode="numeric"
              autoComplete="off"
              defaultValue="7"
            />
          )}
        </FormSheetField>
      </FormSheet>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Purchase orders → + New
 * ------------------------------------------------------------------ */

export function NewPurchaseOrderButton() {
  const data = useDataset()
  const actions = useInventoryActions()
  const suppliers = useSupplierItems()
  const money = useMoney()
  const { t, tk, num } = useLocale()
  const [open, setOpen] = React.useState(false)
  const [supplierId, setSupplierId] = React.useState<string>()

  const changeOpen = (next: boolean) => {
    if (!next) setSupplierId(undefined)
    setOpen(next)
  }

  const today = isoDay(demoToday())
  const supplier = data.suppliers.find((entry) => entry.id === supplierId)
  // Expect delivery after the supplier's usual lead time.
  const expected = isoDay(addDays(demoToday(), supplier?.leadTimeDays ?? 7))

  const submit = (values: FormValues): FormErrors | void => {
    const errors: FormErrors = {}
    const lines = wholeNumber(values.lines, 1)
    const total = parseNumber(values.total)
    if (lines === null) errors.lines = t("forms.wholeNumber", { min: num(1) })
    if (total === null || total <= 0) errors.total = t("forms.positiveNumber")
    if (values.expectedAt < today) errors.expectedAt = t("forms.notInPast")
    if (Object.keys(errors).length > 0 || lines === null || total === null) {
      return errors
    }

    const order = actions.addOrder({
      supplierId: values.supplier,
      lines,
      total: Math.round(total),
      expectedAt: values.expectedAt,
    })
    toast.success(
      t("inventory.forms.orderAdded", {
        number: order.number,
        supplier: suppliers[values.supplier] ?? "",
      })
    )
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus />
        {t("common.new")}
      </Button>
      <FormSheet
        open={open}
        onOpenChange={changeOpen}
        title={t("inventory.forms.orderTitle")}
        description={t("inventory.forms.orderHint")}
        submitLabel={t("inventory.forms.addOrder")}
        onSubmit={submit}
      >
        <FormSheetField
          name="supplier"
          label={t("inventory.supplier")}
          required
          description={
            supplier
              ? t("inventory.forms.supplierLeadTime", {
                  days: tk(
                    `inventory.days.${supplier.leadTimeDays === 1 ? "one" : "other"}`,
                    { count: num(supplier.leadTimeDays) }
                  ),
                })
              : undefined
          }
        >
          {(field, controls) => (
            <FormSheetSelect
              field={field}
              controls={controls}
              items={suppliers}
              onChange={setSupplierId}
            />
          )}
        </FormSheetField>
        <div className="grid grid-cols-2 gap-3">
          <FormSheetField
            name="lines"
            label={t("inventory.forms.lines")}
            required
          >
            {(field) => (
              <Input {...field} inputMode="numeric" autoComplete="off" />
            )}
          </FormSheetField>
          <FormSheetField
            name="total"
            label={`${t("common.amount")} (${money.symbol})`}
            required
          >
            {(field) => (
              <Input {...field} inputMode="decimal" autoComplete="off" />
            )}
          </FormSheetField>
        </div>
        <FormSheetField
          // A new supplier brings its own lead time.
          key={supplierId ?? "none"}
          name="expectedAt"
          label={t("inventory.forms.expected")}
          required
        >
          {(field, controls) => (
            <FormSheetDate
              field={field}
              controls={controls}
              min={today}
              defaultValue={expected}
            />
          )}
        </FormSheetField>
      </FormSheet>
    </>
  )
}
