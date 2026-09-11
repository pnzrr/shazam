import { useEffect, useState } from 'react'
import type { HealthReport } from '../../shared/types.js'
import { api } from '../lib/api.js'

export function useHealth(): HealthReport | null {
  const [health, setHealth] = useState<HealthReport | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .health()
      .then((report) => {
        if (!cancelled) setHealth(report)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return health
}
