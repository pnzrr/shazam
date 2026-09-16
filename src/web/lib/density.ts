import { useCallback, useEffect, useState } from 'react'

export type Density = 'comfortable' | 'compact'

const KEY = 'shazam.density'

function initial(): Density {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'comfortable' || stored === 'compact') return stored
  } catch {
    // storage disabled
  }
  return 'comfortable'
}

/**
 * Comfortable/compact board density, persisted like the appearance toggle.
 * Deliberately not a context: App stamps `data-density` on the board container
 * and the cards restyle themselves with group variants, so no component below
 * App ever needs to read the value.
 */
export function useDensity(): [Density, () => void] {
  const [density, setDensity] = useState<Density>(initial)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, density)
    } catch {
      // storage disabled
    }
  }, [density])

  const toggle = useCallback(() => {
    setDensity((current) => (current === 'compact' ? 'comfortable' : 'compact'))
  }, [])

  return [density, toggle]
}
