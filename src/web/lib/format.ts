const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })

export function relativeTime(iso: string): string {
  const delta = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(delta)
  if (abs < 45_000) return 'just now'

  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return rtf.format(Math.round(delta / ms), unit)
  }
  return rtf.format(Math.round(delta / 1000), 'second')
}

export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString()
}
