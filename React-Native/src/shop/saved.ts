import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

import type { SavedProduct } from './shop'

export type { SavedProduct }

/**
 * The visitor's saved lists — wishlist, compare picks, recently viewed —
 * kept on the device in AsyncStorage. Nothing reaches the server: a wishlist
 * that follows a signed-in customer between devices would need a table of
 * its own. The web starters keep the same three lists in localStorage, with
 * the same limits (`src/shop/shop.ts`).
 *
 * Each list is read once per launch and held in memory, so screens read it
 * synchronously and every screen showing it updates together.
 */
export type SavedList = {
  readonly limit: number
  items(): SavedProduct[]
  has(id: string): boolean
  /** Adds or removes; returns whether it is in the list afterwards. A full
   *  list (compare holds four) adds nothing. */
  toggle(product: SavedProduct): boolean
  /** Puts it first (recently viewed), dropping the oldest past the limit. */
  add(product: SavedProduct): void
  remove(id: string): void
  clear(): void
  subscribe(listener: () => void): () => void
}

function createSavedList(key: string, limit: number): SavedList {
  let items: SavedProduct[] = []
  const listeners = new Set<() => void>()

  const changed = (next: SavedProduct[]) => {
    items = next.slice(0, limit)
    void AsyncStorage.setItem(key, JSON.stringify(items)).catch(() => {
      // A full disk: the list just doesn't persist.
    })
    for (const listener of listeners) listener()
  }

  void AsyncStorage.getItem(key)
    .then((raw) => {
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed)) return
      items = parsed
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          id: typeof item.id === 'string' ? item.id : '',
          name: typeof item.name === 'string' ? item.name : '',
          image: typeof item.image === 'string' ? item.image : null,
          priceCents: typeof item.priceCents === 'number' ? item.priceCents : null,
        }))
        .filter((item) => item.id)
        .slice(0, limit)
      for (const listener of listeners) listener()
    })
    .catch(() => {})

  return {
    limit,
    items: () => items,
    has: (id) => items.some((item) => item.id === id),
    toggle(product) {
      if (items.some((item) => item.id === product.id)) {
        changed(items.filter((item) => item.id !== product.id))
        return false
      }
      if (items.length >= limit) return false
      changed([...items, product])
      return true
    },
    add(product) {
      changed([product, ...items.filter((item) => item.id !== product.id)])
    },
    remove(id) {
      changed(items.filter((item) => item.id !== id))
    },
    clear() {
      changed([])
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const wishlist = createSavedList('bd:wishlist', 60)
/** The compare table fits four. */
export const compareList = createSavedList('bd:compare', 4)
export const recentlyViewed = createSavedList('bd:recently-viewed', 12)

/** A list's items, kept current as it changes. */
export function useSavedList(list: SavedList): SavedProduct[] {
  const [items, setItems] = useState(list.items())
  useEffect(() => {
    setItems(list.items())
    return list.subscribe(() => setItems(list.items()))
  }, [list])
  return items
}
