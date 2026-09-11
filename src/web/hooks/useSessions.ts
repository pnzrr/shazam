import { useCallback, useEffect, useState } from 'react'
import type { AgentSession } from '../../shared/types.js'
import { api } from '../lib/api.js'

export interface SessionsState {
  sessions: AgentSession[]
  activeId: string | null
  setActiveId: (id: string | null) => void
  /** A newly launched session: goes to the front and takes focus. */
  add: (session: AgentSession) => void
  /** A status change on an existing session: no reorder, no focus steal. */
  update: (session: AgentSession) => void
  close: (id: string) => Promise<void>
  reload: () => Promise<void>
}

export function useSessions(): SessionsState {
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const next = await api.sessions()
      setSessions(next)
      // Keep a selection alive if the one we were showing disappeared.
      setActiveId((current) =>
        current && next.some((s) => s.id === current) ? current : (next[0]?.id ?? null),
      )
    } catch {
      // The dock is non-critical; a failed list just leaves it as-is.
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const add = useCallback((session: AgentSession) => {
    setSessions((current) => [session, ...current.filter((s) => s.id !== session.id)])
    setActiveId(session.id)
  }, [])

  const update = useCallback((session: AgentSession) => {
    setSessions((current) =>
      current.some((s) => s.id === session.id)
        ? current.map((s) => (s.id === session.id ? session : s))
        : [session, ...current],
    )
  }, [])

  const close = useCallback(async (id: string) => {
    await api.closeSession(id).catch(() => {})
    setSessions((current) => {
      const next = current.filter((s) => s.id !== id)
      setActiveId((active) => (active === id ? (next[0]?.id ?? null) : active))
      return next
    })
  }, [])

  return { sessions, activeId, setActiveId, add, update, close, reload }
}
