"use client"

import { create } from "zustand"

import type { Dataset } from "@/lib/types"

/**
 * Session edits — everything the demo user creates or changes, layered over
 * the generated dataset.
 *
 * The generator stays pure: `DataProvider` merges these edits over its cached
 * dataset, so a new or changed record shows up on every screen that reads the
 * collection — lists, KPIs, sidebar counts. Edits are kept per property, so a
 * change at one property never leaks into another that happens to share the
 * same generated ids (every property has a `deal_1`).
 *
 * Deliberately not persisted. The server and the first client render both
 * start from an empty layer, so nothing here can cause a hydration mismatch,
 * and a reload always returns to the pristine, rehearsed demo.
 *
 * Components use `useDataEdits()` from `@/lib/data`, which binds these
 * actions to the active property.
 */

/** Dataset collections whose records carry an `id` — the ones that can be edited. */
export type Collection = {
  [K in keyof Dataset]: Dataset[K] extends readonly { id: string }[] ? K : never
}[keyof Dataset]

export type RecordOf<K extends Collection> = Dataset[K][number]

type Entity = { id: string }

type CollectionEdits<K extends Collection> = {
  /** Records created this session, newest first. */
  added: RecordOf<K>[]
  /** Field-level changes by record id. They apply to added records too. */
  changed: Record<string, Partial<RecordOf<K>>>
}

export type PropertyEdits = { [K in Collection]?: CollectionEdits<K> }

type SessionState = {
  /** Edits by property (tenant) id. */
  edits: Record<string, PropertyEdits>
  sequence: number
  add: <K extends Collection>(
    tenantId: string,
    collection: K,
    record: RecordOf<K>
  ) => void
  update: <K extends Collection>(
    tenantId: string,
    collection: K,
    ids: readonly string[],
    changes: Partial<RecordOf<K>>
  ) => void
  nextSequence: () => number
  reset: () => void
}

export const useSession = create<SessionState>()((set, get) => ({
  edits: {},
  sequence: 0,

  add: (tenantId, collection, record) =>
    set((state) => {
      const property = state.edits[tenantId] ?? {}
      const current = property[collection] ?? { added: [], changed: {} }
      return {
        edits: {
          ...state.edits,
          [tenantId]: {
            ...property,
            [collection]: { ...current, added: [record, ...current.added] },
          },
        },
      }
    }),

  update: (tenantId, collection, ids, changes) =>
    set((state) => {
      if (ids.length === 0) return state
      const property = state.edits[tenantId] ?? {}
      const current = property[collection] ?? { added: [], changed: {} }
      const changed = { ...current.changed }
      for (const id of ids) changed[id] = { ...changed[id], ...changes }
      return {
        edits: {
          ...state.edits,
          [tenantId]: { ...property, [collection]: { ...current, changed } },
        },
      }
    }),

  nextSequence: () => {
    const sequence = get().sequence + 1
    set({ sequence })
    return sequence
  },

  reset: () => set({ edits: {}, sequence: 0 }),
}))

/** The generated dataset with one property's session edits applied. */
export function applyEdits(
  base: Dataset,
  edits: PropertyEdits | undefined
): Dataset {
  if (!edits) return base
  let merged: Dataset | null = null
  for (const collection of Object.keys(edits) as Collection[]) {
    const collectionEdits = edits[collection]
    if (!collectionEdits) continue
    merged ??= { ...base }
    // Each collection is edited with its own record type; TypeScript cannot
    // follow that correlation through the loop, so widen to the shared shape.
    ;(merged as Record<Collection, unknown>)[collection] = mergeCollection(
      base[collection] as readonly Entity[],
      collectionEdits as unknown as {
        added: Entity[]
        changed: Record<string, Partial<Entity>>
      }
    )
  }
  return merged ?? base
}

/**
 * Added records first (newest first), then the generated ones, each with its
 * changes applied. Untouched records keep their identity.
 */
function mergeCollection<T extends Entity>(
  records: readonly T[],
  edits: { added: readonly T[]; changed: Record<string, Partial<T>> }
): T[] {
  const patch = (record: T) => {
    const change = edits.changed[record.id]
    return change ? { ...record, ...change } : record
  }
  return [...edits.added.map(patch), ...records.map(patch)]
}
