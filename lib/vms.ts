import type {
  ClearanceLevel,
  GateId,
  TagHue,
  Vehicle,
  Visitor,
} from "@/lib/types"
import type { TranslationKey } from "@/lib/i18n"

export const GATE_IDS: GateId[] = [
  "mainLobby",
  "porte",
  "service",
  "basement",
  "banquet",
  "staff",
]

/** Badges run V-1200, V-1204, … — the next pass continues the sequence. */
export function nextBadge(visitors: readonly Visitor[]) {
  const highest = Math.max(
    1196,
    ...visitors.map((visitor) => Number(visitor.badge.slice(2)) || 0)
  )
  return `V-${highest + 4}`
}

/** The parking decks drawn on the vehicles screen. */
export const PARKING_DECKS = [
  { id: "P", size: 6 },
  { id: "B1", size: 42 },
  { id: "B2", size: 42 },
] as const

export function bayCode(
  deck: (typeof PARKING_DECKS)[number]["id"],
  index: number
) {
  return deck === "P"
    ? `P${index + 1}`
    : `${deck}-${String(index + 1).padStart(2, "0")}`
}

/**
 * The first free bay for a new arrival: VIP and CIP get the reserved
 * forecourt bays, everyone else the basement decks. Undefined when full.
 */
export function freeBay(
  vehicles: readonly Vehicle[],
  clearance: ClearanceLevel
) {
  const taken = new Set(
    vehicles
      .filter((vehicle) => !vehicle.exitAt && vehicle.bay)
      .map((v) => v.bay)
  )
  const decks = isEscalated(clearance)
    ? PARKING_DECKS.filter((deck) => deck.id === "P")
    : PARKING_DECKS.filter((deck) => deck.id !== "P")
  for (const deck of decks) {
    for (let index = 0; index < deck.size; index++) {
      const code = bayCode(deck.id, index)
      if (!taken.has(code)) return code
    }
  }
  return undefined
}

export const CLEARANCE_ORDER: ClearanceLevel[] = [
  "standard",
  "vip",
  "cip",
  "restricted",
]

export const CLEARANCE_HUE: Record<ClearanceLevel, TagHue> = {
  standard: "slate",
  vip: "amber",
  cip: "purple",
  restricted: "rose",
}

export const CLEARANCE_LABEL: Record<ClearanceLevel, TranslationKey> = {
  standard: "vms.clearance.standard",
  vip: "vms.clearance.vip",
  cip: "vms.clearance.cip",
  restricted: "vms.clearance.restricted",
}

/** Escalated clearance is only meaningful if it actually grants something. */
export const CLEARANCE_PERKS: Record<ClearanceLevel, TranslationKey[]> = {
  standard: [],
  vip: [
    "vms.perks.expressLane",
    "vms.perks.reservedBay",
    "vms.perks.hostGreeting",
    "vms.perks.porterService",
  ],
  cip: [
    "vms.perks.expressLane",
    "vms.perks.noScreening",
    "vms.perks.reservedBay",
    "vms.perks.privateLift",
    "vms.perks.loungeAccess",
    "vms.perks.porterService",
    "vms.perks.escortWaiver",
    "vms.perks.hostGreeting",
  ],
  restricted: [],
}

export function isEscalated(level: ClearanceLevel) {
  return level === "vip" || level === "cip"
}

/** Minutes a visitor has been on site, or the full duration if they've left. */
export function dwellMinutes(
  checkedInAt: string,
  checkedOutAt: string | undefined,
  now: number
) {
  const end = checkedOutAt ? new Date(checkedOutAt).getTime() : now
  return Math.max(
    0,
    Math.round((end - new Date(checkedInAt).getTime()) / 60000)
  )
}

/** Minutes past the expected departure, measured against the demo clock. */
export function overstayMinutes(
  expectedOutAt: string | undefined,
  checkedOutAt: string | undefined,
  now: number
) {
  if (checkedOutAt || !expectedOutAt) return 0
  return Math.max(
    0,
    Math.round((now - new Date(expectedOutAt).getTime()) / 60000)
  )
}

/** A visitor is overstaying once they pass their expected departure. */
export function isOverstaying(
  expectedOutAt: string | undefined,
  checkedOutAt: string | undefined,
  now: number
) {
  if (checkedOutAt || !expectedOutAt) return false
  return new Date(expectedOutAt).getTime() < now
}
