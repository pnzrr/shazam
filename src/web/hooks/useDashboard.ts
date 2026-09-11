import { useCallback, useEffect, useRef, useState } from 'react'
import type { DashboardData } from '../../shared/types.js'
import { ApiError, api } from '../lib/api.js'

export interface DashboardState {
  data: DashboardData | null
  loading: boolean
  refreshing: boolean
  /** Transport-level failure. Poll failures ride along inside `data.error`. */
  error: string | null
  unauthorized: boolean
  refresh: () => Promise<void>
}

/**
 * Reads the server's cache on an interval. The server owns the GitHub polling,
 * so this can be frequent without costing API quota.
 */
export function useDashboard(intervalMs: number): DashboardState {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const mounted = useRef(true)

  const load = useCallback(async (force: boolean) => {
    if (force) setRefreshing(true)
    try {
      const next = force ? await api.refresh() : await api.dashboard()
      if (!mounted.current) return
      setData(next)
      setError(null)
      setUnauthorized(false)
    } catch (err) {
      if (!mounted.current) return
      if (err instanceof ApiError && err.status === 401) setUnauthorized(true)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void load(false)

    // Poll a little faster than the server does so a fresh payload shows up
    // promptly, and skip work entirely while the tab is in the background.
    const clientInterval = Math.max(5_000, Math.round(intervalMs / 4))
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load(false)
    }, clientInterval)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(false)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      mounted.current = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs, load])

  return {
    data,
    loading,
    refreshing,
    error,
    unauthorized,
    refresh: () => load(true),
  }
}
