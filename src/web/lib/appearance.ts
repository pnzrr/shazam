import { useCallback, useEffect, useState } from 'react'

export type Appearance = 'light' | 'dark'

const KEY = 'shazam.appearance'

function initial(): Appearance {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // storage disabled
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useAppearance(): [Appearance, () => void] {
  const [appearance, setAppearance] = useState<Appearance>(initial)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, appearance)
    } catch {
      // storage disabled
    }
    document.documentElement.style.colorScheme = appearance
  }, [appearance])

  const toggle = useCallback(() => {
    setAppearance((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return [appearance, toggle]
}
