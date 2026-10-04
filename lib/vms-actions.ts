"use client"

import * as React from "react"
import { toast } from "sonner"

import { useDataEdits, useDataset } from "@/lib/data"
import { addMinutes, demoNow } from "@/lib/demo-time"
import { useLocale } from "@/lib/i18n/provider"
import { LUGGAGE_LOCATIONS, LUGGAGE_WITH_VISITOR } from "@/lib/mock/pools"
import { freeBay, nextBadge } from "@/lib/vms"
import type {
  ClearanceLevel,
  GateId,
  GateMovement,
  LuggageItem,
  Vehicle,
  VehicleType,
  Visitor,
  VisitorPurpose,
} from "@/lib/types"

/** What the Issue pass form collects. */
export type NewPass = {
  name: string
  company: string
  phone: string
  purpose: VisitorPurpose
  hostStaffId: string
  clearance: ClearanceLevel
  escortStaffId?: string
  idType: Visitor["idType"]
  idNumber: string
  gate: GateId
  stayHours: number
  plate?: string
  vehicleType?: VehicleType
}

/* Which records each action applies to. Bulk-action buttons use the same
   rules to disable themselves when nothing selected qualifies. */
export const canCheckOut = (visitor: Visitor) => !visitor.checkedOutAt
/** Unscreened, or still sitting at the screening bay even if already passed. */
export const canScreenLuggage = (item: LuggageItem) =>
  item.state !== "released" && (!item.screened || item.state === "screening")
export const canStoreLuggage = (item: LuggageItem) =>
  item.state === "withVisitor"
export const canReturnLuggage = (item: LuggageItem) =>
  item.state === "leftLuggage" ||
  item.state === "held" ||
  item.state === "screening"
export const canScreenVehicle = (vehicle: Vehicle) => !vehicle.screened
export const canRecordExit = (vehicle: Vehicle) => !vehicle.exitAt

/**
 * Gate desk actions for visitor management. Every change goes through the
 * session edits layer, so the overview, movements feed, clearance list, gate
 * passes, parking map and sidebar count all follow at once.
 *
 * Bulk actions skip the records they don't apply to (an already screened bag,
 * a vehicle that has left) and say so in the toast.
 */
export function useVmsActions() {
  const data = useDataset()
  const edits = useDataEdits()
  const { t, tk, num, locale } = useLocale()

  return React.useMemo(() => {
    /** The gate desk on duty — the first security officer. */
    const deskOfficer =
      data.staff.find((member) => member.department === "security") ??
      data.staff[0]
    const porter =
      data.staff.find((member) => member.department === "frontOffice") ??
      data.staff[0]

    const now = () => new Date(demoNow()).toISOString()

    /** "1 bag …" / "3 bags …" — keys with `one` and `other` forms. */
    const counted = (key: string, count: number) =>
      tk(`${key}.${count === 1 ? "one" : "other"}`, { count: num(count) })

    const skippedNote = (skipped: number) =>
      skipped > 0 ? { description: counted("vms.skipped", skipped) } : {}

    const checkOut = (visitors: readonly Visitor[]) => {
      const leaving = visitors.filter(canCheckOut)
      if (leaving.length === 0) return
      const at = now()
      const leavingIds = new Set(leaving.map((visitor) => visitor.id))

      edits.update("visitors", [...leavingIds], { checkedOutAt: at })

      const bags = data.luggage.filter((item) => leavingIds.has(item.visitorId))
      // Bags in the visitor's care or in left luggage go home with them;
      // anything held or still in screening stays with security.
      const returned = bags.filter(
        (item) => item.state === "withVisitor" || item.state === "leftLuggage"
      )
      const keptBySecurity = bags.filter(
        (item) => item.state === "held" || item.state === "screening"
      )
      edits.update(
        "luggage",
        returned.map((item) => item.id),
        { state: "released", releasedAt: at }
      )

      for (const visitor of leaving) {
        const entry = data.movements.find(
          (movement) =>
            movement.visitorId === visitor.id && movement.direction === "in"
        )
        const exit: GateMovement = {
          id: edits.newId("mov"),
          visitorId: visitor.id,
          direction: "out",
          gate: visitor.gate,
          at,
          method: entry?.method ?? "badge",
          clearance: visitor.clearance,
          operatorStaffId: deskOfficer.id,
          vehicleId: visitor.vehicleId,
          luggageCount: bags.filter((item) => item.visitorId === visitor.id)
            .length,
        }
        edits.add("movements", exit)
      }

      const skipped = visitors.length - leaving.length
      const notes = [
        returned.length > 0 ? counted("vms.bagsReturned", returned.length) : "",
        keptBySecurity.length > 0
          ? counted("vms.bagsWithSecurity", keptBySecurity.length)
          : "",
        skipped > 0 ? counted("vms.skipped", skipped) : "",
      ].filter(Boolean)
      toast.success(
        leaving.length === 1
          ? t("vms.checkedOutOne", { name: leaving[0].name[locale] })
          : counted("vms.checkedOutMany", leaving.length),
        notes.length > 0 ? { description: notes.join(" · ") } : undefined
      )
    }

    const issuePass = (pass: NewPass): Visitor => {
      const at = now()
      const visitorId = edits.newId("vis")
      const badge = nextBadge(data.visitors)
      // A typed name can't be transliterated, so both languages share it.
      const name = { en: pass.name, bn: pass.name }

      let vehicle: Vehicle | undefined
      if (pass.plate) {
        // Like names, a typed plate can't be transliterated, so both
        // languages show it as entered.
        const plate = pass.plate.toUpperCase()
        vehicle = {
          id: edits.newId("veh"),
          plate: { en: plate, bn: plate },
          type: pass.vehicleType ?? "car",
          make: "",
          colour: { en: "", bn: "" },
          driver: name,
          visitorId,
          bay: freeBay(data.vehicles, pass.clearance),
          entryAt: at,
          passHours: pass.stayHours,
          // CIP waives screening; everyone else is screened on arrival.
          screened: pass.clearance === "cip",
          clearance: pass.clearance,
        }
        edits.add("vehicles", vehicle)
      }

      const escortRequired =
        pass.clearance === "restricted" ||
        (pass.clearance === "cip" && Boolean(pass.escortStaffId))

      const visitor: Visitor = {
        id: visitorId,
        name,
        company: { en: pass.company, bn: pass.company },
        purpose: pass.purpose,
        hostStaffId: pass.hostStaffId,
        badge,
        checkedInAt: at,
        vehicleId: vehicle?.id,
        phone: pass.phone,
        clearance: pass.clearance,
        escortRequired,
        escortStaffId: escortRequired ? pass.escortStaffId : undefined,
        idType: pass.idType,
        idNumber: pass.idNumber,
        expectedOutAt: addMinutes(
          new Date(demoNow()),
          pass.stayHours * 60
        ).toISOString(),
        photoSeed: `pass-${visitorId}`,
        gate: pass.gate,
      }
      edits.add("visitors", visitor)

      edits.add("movements", {
        id: edits.newId("mov"),
        visitorId,
        direction: "in",
        gate: pass.gate,
        at,
        method: vehicle ? "anpr" : "badge",
        clearance: pass.clearance,
        operatorStaffId: deskOfficer.id,
        vehicleId: vehicle?.id,
        luggageCount: 0,
      })

      let parking: string | undefined
      if (vehicle) {
        parking = vehicle.bay
          ? t("vms.pass.bayAssigned", { bay: vehicle.bay })
          : t("vms.pass.noBayFree")
      }
      toast.success(t("vms.pass.issued", { badge, name: pass.name }), {
        description: parking,
      })
      return visitor
    }

    const markLuggageScreened = (items: readonly LuggageItem[]) => {
      const eligible = items.filter(canScreenLuggage)
      if (eligible.length === 0) return
      edits.update(
        "luggage",
        eligible.map((item) => item.id),
        { screened: true, screenedByStaffId: deskOfficer.id }
      )
      // A bag cleared at the screening bay goes back to its owner.
      edits.update(
        "luggage",
        eligible
          .filter((item) => item.state === "screening")
          .map((item) => item.id),
        { state: "withVisitor", location: LUGGAGE_WITH_VISITOR }
      )
      toast.success(
        counted("vms.luggage.markedScreened", eligible.length),
        skippedNote(items.length - eligible.length)
      )
    }

    const storeLuggage = (items: readonly LuggageItem[]) => {
      const eligible = items.filter(canStoreLuggage)
      if (eligible.length === 0) return
      edits.update(
        "luggage",
        eligible.map((item) => item.id),
        {
          state: "leftLuggage",
          location: LUGGAGE_LOCATIONS[0],
          porterStaffId: porter.id,
        }
      )
      toast.success(
        counted("vms.luggage.stored", eligible.length),
        skippedNote(items.length - eligible.length)
      )
    }

    const returnLuggage = (items: readonly LuggageItem[]) => {
      const eligible = items.filter(canReturnLuggage)
      if (eligible.length === 0) return
      edits.update(
        "luggage",
        eligible.map((item) => item.id),
        { state: "released", releasedAt: now() }
      )
      toast.success(
        counted("vms.luggage.returned", eligible.length),
        skippedNote(items.length - eligible.length)
      )
    }

    const markVehiclesScreened = (vehicles: readonly Vehicle[]) => {
      const eligible = vehicles.filter(canScreenVehicle)
      if (eligible.length === 0) return
      edits.update(
        "vehicles",
        eligible.map((vehicle) => vehicle.id),
        { screened: true }
      )
      toast.success(
        counted("vms.vehicles.markedScreened", eligible.length),
        skippedNote(vehicles.length - eligible.length)
      )
    }

    const recordVehicleExit = (vehicles: readonly Vehicle[]) => {
      const eligible = vehicles.filter(canRecordExit)
      if (eligible.length === 0) return
      edits.update(
        "vehicles",
        eligible.map((vehicle) => vehicle.id),
        { exitAt: now() }
      )
      toast.success(
        counted("vms.vehicles.exitRecorded", eligible.length),
        skippedNote(vehicles.length - eligible.length)
      )
    }

    return {
      checkOut,
      issuePass,
      markLuggageScreened,
      storeLuggage,
      returnLuggage,
      markVehiclesScreened,
      recordVehicleExit,
    }
  }, [data, edits, t, tk, num, locale])
}
