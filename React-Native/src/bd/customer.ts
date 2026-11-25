import { useEffect, useState } from 'react'

import { getBdDev } from './client'
import { getSessionToken } from './session'

/**
 * The signed-in customer, for what only they can do here: like a post,
 * comment on it, write a review. The token comes from the Account tab's
 * sign-in (Keychain / Keystore); `auth.me` says whose it is and which
 * business it belongs to, so the portal client is pinned to that business.
 */
export type Customer = {
  token: string
  organizationId: string
  email: string | null
}

export async function getCustomer(): Promise<Customer | null> {
  const bd = getBdDev()
  const token = await getSessionToken()
  if (!bd || !token) return null
  try {
    const me = await bd.auth.me({ sessionToken: token })
    return me ? { token, organizationId: me.organizationId, email: me.user.email ?? null } : null
  } catch {
    return null
  }
}

/** The customer portal as the signed-in customer (reviews they write). */
export function portalFor(customer: Customer) {
  const bd = getBdDev()
  return bd ? bd.customerPortal(customer.organizationId).withSession(customer.token) : null
}

/**
 * The signed-in customer, looked up when a screen opens: `undefined` while
 * looking, then the customer or `null`. `refresh` looks again (after
 * signing in on the Account tab and coming back).
 */
export function useCustomer(): { customer: Customer | null | undefined; refresh: () => void } {
  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined)
  const [asked, setAsked] = useState(0)
  useEffect(() => {
    let alive = true
    void getCustomer().then((value) => {
      if (alive) setCustomer(value)
    })
    return () => {
      alive = false
    }
  }, [asked])
  return { customer, refresh: () => setAsked((n) => n + 1) }
}
