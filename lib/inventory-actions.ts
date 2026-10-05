"use client"

import * as React from "react"

import { useDataEdits, useDataset } from "@/lib/data"
import { addDays, demoToday, isoDay } from "@/lib/demo-time"
import { nextSerial } from "@/lib/numbering"
import type {
  Bilingual,
  InventoryItem,
  PurchaseOrder,
  Supplier,
} from "@/lib/types"

export type NewItem = {
  name: string
  category: Bilingual
  unit: Bilingual
  onHand: number
  reorderPoint: number
  supplierId: string
  unitCost: number
}

export type NewSupplier = {
  name: string
  category: Bilingual
  contact: string
  phone: string
  leadTimeDays: number
}

export type NewOrder = {
  supplierId: string
  lines: number
  total: number
  expectedAt: string
}

/** Below its reorder point and not already on order. */
export function needsReorder(item: InventoryItem) {
  return item.onHand < item.reorderPoint && !item.reorderedAt
}

/** Enough to bring stock up to twice the reorder point; at least one. */
export function reorderQuantity(item: InventoryItem) {
  return Math.max(1, item.reorderPoint * 2 - item.onHand)
}

/**
 * Stock, suppliers and purchase orders. Raising an order also counts it
 * against the supplier's open orders, and reordering marks the items as on
 * order so they aren't ordered twice.
 */
export function useInventoryActions() {
  const data = useDataset()
  const edits = useDataEdits()

  return React.useMemo(() => {
    const today = demoToday()
    const orderPrefix = `PO-${today.getUTCFullYear()}-`
    // Orders raised together each need their own number, before any of them
    // reaches the dataset.
    const orderNumbers = () => {
      let next = nextSerial(
        data.purchaseOrders.map((order) => order.number),
        orderPrefix,
        { step: 3 }
      )
      return () => {
        const number = next
        next = nextSerial([number], orderPrefix, { step: 3 })
        return number
      }
    }
    const countOrders = (supplierId: string, count: number) => {
      const supplier = data.suppliers.find((s) => s.id === supplierId)
      if (supplier) {
        edits.update("suppliers", supplierId, {
          openOrders: supplier.openOrders + count,
        })
      }
    }

    return {
      addItem(input: NewItem): InventoryItem {
        const prefix = `${input.category.en.slice(0, 3).toUpperCase()}-`
        const item: InventoryItem = {
          id: edits.newId("inv"),
          sku: nextSerial(
            data.inventory.map((entry) => entry.sku),
            prefix,
            { step: 7, start: 1000 }
          ),
          name: { en: input.name, bn: input.name },
          category: input.category,
          onHand: input.onHand,
          reorderPoint: input.reorderPoint,
          unitCost: input.unitCost,
          unit: input.unit,
          supplierId: input.supplierId,
          updatedAt: isoDay(today),
        }
        edits.add("inventory", item)
        return item
      },

      addSupplier(input: NewSupplier): Supplier {
        const supplier: Supplier = {
          id: edits.newId("sup"),
          name: { en: input.name, bn: input.name },
          category: input.category,
          contact: { en: input.contact, bn: input.contact },
          phone: input.phone,
          leadTimeDays: input.leadTimeDays,
          // Not rated until the first delivery.
          rating: 0,
          openOrders: 0,
        }
        edits.add("suppliers", supplier)
        return supplier
      },

      addOrder(input: NewOrder): PurchaseOrder {
        const order: PurchaseOrder = {
          id: edits.newId("po"),
          number: orderNumbers()(),
          supplierId: input.supplierId,
          status: "draft",
          total: input.total,
          lines: input.lines,
          createdAt: isoDay(today),
          expectedAt: input.expectedAt,
        }
        edits.add("purchaseOrders", order)
        countOrders(input.supplierId, 1)
        return order
      },

      /**
       * Draft purchase orders for these items, one per supplier, each line
       * ordering enough to reach twice the reorder point. Items already on
       * order are left out. Returns the orders raised.
       */
      reorder(items: readonly InventoryItem[]): PurchaseOrder[] {
        const bySupplier = new Map<string, InventoryItem[]>()
        for (const item of items) {
          if (item.reorderedAt) continue
          bySupplier.set(item.supplierId, [
            ...(bySupplier.get(item.supplierId) ?? []),
            item,
          ])
        }
        const nextNumber = orderNumbers()
        const orders: PurchaseOrder[] = []
        for (const [supplierId, lines] of bySupplier) {
          const supplier = data.suppliers.find((s) => s.id === supplierId)
          const order: PurchaseOrder = {
            id: edits.newId("po"),
            number: nextNumber(),
            supplierId,
            status: "draft",
            total: Math.round(
              lines.reduce(
                (sum, item) => sum + reorderQuantity(item) * item.unitCost,
                0
              )
            ),
            lines: lines.length,
            createdAt: isoDay(today),
            expectedAt: isoDay(addDays(today, supplier?.leadTimeDays ?? 7)),
          }
          edits.add("purchaseOrders", order)
          countOrders(supplierId, 1)
          orders.push(order)
        }
        const ordered = [...bySupplier.values()].flat().map((item) => item.id)
        edits.update("inventory", ordered, { reorderedAt: isoDay(today) })
        return orders
      },
    }
  }, [data.inventory, data.purchaseOrders, data.suppliers, edits])
}
