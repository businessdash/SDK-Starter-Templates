import { useEffect, useState } from 'react'

import { getBd } from './client'
import { getVisitorToken } from './session'

/**
 * How many things are in the cart, for the Cart tab's badge. Every screen
 * that changes the cart passes the cart it got back to `noteCart`, so the
 * badge follows without another fetch; `refreshCartCount` reads it at launch.
 */
let count = 0
const listeners = new Set<(count: number) => void>()

export function noteCart(cart: { itemCount?: number | null } | null | undefined) {
  count = Math.max(0, cart?.itemCount ?? 0)
  for (const listener of listeners) listener(count)
}

export async function refreshCartCount() {
  const bd = getBd()
  if (!bd) return
  try {
    noteCart(await bd.cart.forVisitor(await getVisitorToken()).get())
  } catch {
    // No badge is better than a wrong one.
  }
}

export function useCartCount(): number {
  const [value, setValue] = useState(count)
  useEffect(() => {
    listeners.add(setValue)
    setValue(count)
    return () => {
      listeners.delete(setValue)
    }
  }, [])
  return value
}
