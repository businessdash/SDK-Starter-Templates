import { useEffect, useState } from 'react'

import { getVisitorToken } from './session'

/** Resolves the persisted cart visitor id once per app launch. */
export function useVisitorToken(): string | null {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void getVisitorToken().then((value) => {
      if (alive) setToken(value)
    })
    return () => {
      alive = false
    }
  }, [])

  return token
}

export type Load<T> =
  | { status: 'loading' }
  | { status: 'loaded'; value: T }
  | { status: 'failed'; message: string; isUnavailable: boolean }

/**
 * Runs an async read and maps failures into a shape screens can render.
 *
 * `isUnavailable` separates "the org's site is lapsed or suspended" from "the
 * network blipped" — a distinction the SDK's error classes already draw, and
 * one a customer reads very differently.
 */
export function useLoad<T>(run: () => Promise<T>, deps: unknown[]): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })

    void run()
      .then((value) => {
        if (alive) setState({ status: 'loaded', value })
      })
      .catch((error: unknown) => {
        if (!alive) return
        const name = error instanceof Error ? error.name : ''
        setState({
          status: 'failed',
          message: error instanceof Error ? error.message : 'Something went wrong.',
          isUnavailable:
            name === 'BiabPaymentLapsedError' || name === 'BiabServiceSuspendedError',
        })
      })

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
