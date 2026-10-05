"use client"

import * as React from "react"

import { useDataEdits, useDataset, useTenant } from "@/lib/data"
import { demoNow } from "@/lib/demo-time"
import { nextSerial } from "@/lib/numbering"
import type {
  Bilingual,
  BookingSource,
  Guest,
  Reservation,
  Room,
  RoomTypeId,
} from "@/lib/types"

/** Not cancelled and not a no-show: the stay holds its room. */
export function holdsRoom(reservation: Reservation) {
  return reservation.status !== "cancelled" && reservation.status !== "noShow"
}

/**
 * Rooms free for every night from `from` up to the check-out day `to`, by
 * type, lowest room number first. A room is free when it isn't out of
 * service and no other stay holds it on any of those nights.
 */
export function freeRoomsByType(
  rooms: readonly Room[],
  reservations: readonly Reservation[],
  from: string,
  to: string
) {
  const taken = new Set<string>()
  for (const reservation of reservations) {
    if (
      holdsRoom(reservation) &&
      reservation.checkIn < to &&
      reservation.checkOut > from
    ) {
      taken.add(reservation.roomId)
    }
  }
  const free = new Map<RoomTypeId, Room[]>()
  for (const room of rooms) {
    if (room.housekeeping === "outOfService" || taken.has(room.id)) continue
    free.set(room.typeId, [...(free.get(room.typeId) ?? []), room])
  }
  for (const list of free.values()) {
    list.sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true })
    )
  }
  return free
}

export type NewGuest = {
  name: string
  phone: string
  email: string
  nationality: Bilingual
}

export type NewReservation = {
  guestId: string
  roomTypeId: RoomTypeId
  /** Check-in day, ISO. */
  from: string
  /** Check-out day, ISO. */
  to: string
  nights: number
  adults: number
  children: number
  /** Nightly room rate, before extras, service charge and tax. */
  rate: number
  /** Everything the guest pays: room, extras, service charge and tax. */
  total: number
  source: BookingSource
}

/**
 * Creating guests and bookings. A new booking takes the lowest-numbered free
 * room of its type, so it lands on the room rack, the calendar, the bookings
 * list and — when it arrives today — the front desk.
 */
export function useBookingActions() {
  const data = useDataset()
  const tenant = useTenant()
  const edits = useDataEdits()

  return React.useMemo(
    () => ({
      addGuest(input: NewGuest): Guest {
        const id = edits.newId("guest")
        const guest: Guest = {
          id,
          // Typed names read the same in both languages.
          name: { en: input.name, bn: input.name },
          email: input.email,
          phone: input.phone,
          nationality: input.nationality,
          tier: "member",
          stays: 0,
          lifetimeValue: 0,
          preferences: [],
          avatarSeed: `${input.name}-${id}`,
        }
        edits.add("guests", guest)
        return guest
      },

      /** Null when the room type has no free room left for those dates. */
      createReservation(input: NewReservation): Reservation | null {
        const room = freeRoomsByType(
          data.rooms,
          data.reservations,
          input.from,
          input.to
        ).get(input.roomTypeId)?.[0]
        if (!room) return null

        const reservation: Reservation = {
          id: edits.newId("res"),
          code: nextSerial(
            data.reservations.map((r) => r.code),
            tenant.initials
          ),
          guestId: input.guestId,
          roomId: room.id,
          roomTypeId: input.roomTypeId,
          checkIn: input.from,
          checkOut: input.to,
          nights: input.nights,
          adults: input.adults,
          children: input.children,
          status: "confirmed",
          source: input.source,
          rate: input.rate,
          total: input.total,
          paid: 0,
          createdAt: new Date(demoNow()).toISOString(),
        }
        edits.add("reservations", reservation)
        return reservation
      },
    }),
    [data.rooms, data.reservations, tenant.initials, edits]
  )
}
