import { useCallback, useEffect, useRef, useState } from 'react'

import { getBdDev } from './client'

export type ChatMessage = {
  id: string
  role: string
  content: string
  createdAt?: string | null
}

/**
 * Front Desk chat, on the persisted-session flow.
 *
 * There are two chat surfaces in the SDK and it matters which you pick:
 *
 * - `chatbot.chat({ messages })` is a **stateless AI turn** — you send the
 *   whole transcript, it answers. Nothing is stored, and a human can't join.
 * - `createPersistedSession` + `postMessage` + `pollMessages` is the **Front
 *   Desk** flow: the thread lives on the platform, staff can see it and take
 *   over, and `requestHuman` escalates. That's what this uses.
 *
 * The API is **polling-only** — there is no SSE or WebSocket anywhere in the
 * Package API. The platform's guidance is `chatbot/messages` every 3–5s while
 * the widget is open.
 *
 * Two things this hook gets right that a naive `setInterval` doesn't:
 *
 * 1. **It stops.** The effect's cleanup flips a flag the loop checks, so
 *    navigating away halts polling. An interval left running in a mobile app
 *    burns battery and the org's rate limit for as long as the process lives.
 * 2. **It de-duplicates on id.** `since` only advances if the server returns a
 *    usable timestamp; without one the next poll replays rows that would
 *    otherwise be appended twice.
 */
export function useChat(visitorToken: string | null) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const seen = useRef(new Set<string>())

  // Mint (or resume) the persisted session once the visitor id is known.
  useEffect(() => {
    const bd = getBdDev()
    if (!bd || !visitorToken) return

    let alive = true
    void bd.chatbot
      .createPersistedSession({ visitorToken })
      .then((session) => {
        if (alive) setSessionId(session.sessionId)
      })
      .catch((caught: unknown) => {
        if (alive) {
          setError(caught instanceof Error ? caught.message : 'Chat is unavailable.')
        }
      })

    return () => {
      alive = false
    }
  }, [visitorToken])

  useEffect(() => {
    const bd = getBdDev()
    if (!bd || !sessionId || !visitorToken) return

    let running = true
    let since: string | undefined
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    void (async () => {
      while (running) {
        try {
          const response = await bd.chatbot.pollMessages({ sessionId, visitorToken, since })
          const incoming = (response.messages ?? []) as ChatMessage[]

          const fresh = incoming.filter((message) => {
            if (seen.current.has(message.id)) return false
            seen.current.add(message.id)
            return true
          })

          if (fresh.length > 0 && running) {
            setMessages((current) => [...current, ...fresh])
          }

          since = incoming.at(-1)?.createdAt ?? since
          setError(null)
          await sleep(4000)
        } catch (caught) {
          // A blip is not a reason to close a chat screen — back off rather
          // than hammer a failing endpoint every four seconds.
          setError(caught instanceof Error ? caught.message : 'Chat is unavailable.')
          await sleep(15000)
        }
      }
    })()

    return () => {
      running = false
    }
  }, [sessionId, visitorToken])

  const send = useCallback(
    async (text: string) => {
      const bd = getBdDev()
      if (!bd || !sessionId || !visitorToken) return
      // The next poll picks up the echo, so nothing is merged locally.
      await bd.chatbot.postMessage({ sessionId, visitorToken, content: text, role: 'visitor' })
    },
    [sessionId, visitorToken],
  )

  return { messages, error, send, ready: sessionId !== null }
}
