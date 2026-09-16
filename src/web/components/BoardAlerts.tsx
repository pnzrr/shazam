import { useEffect, useRef } from 'react'
import type { DashboardData } from '../../shared/types.js'
import { COLUMNS } from './columns/index.js'
import { useToast } from './Toaster.js'

export interface BoardAlertsProps {
  data: DashboardData | null
  /** The bell in the header; off means silence, not just no desktop pings. */
  enabled: boolean
  /** Select and scroll to a card, for a notification click. */
  onFocusItem: (id: string) => void
}

interface AlertLine {
  tone: 'success' | 'error' | 'info'
  message: string
  itemId: string
}

/**
 * What changed between two polls, said briefly. New arrivals are judged
 * against the whole previous board, not per column, so a card that merely
 * moved columns after one of your own actions stays quiet.
 */
function diffBoard(prev: DashboardData, next: DashboardData): AlertLine[] {
  const lines: AlertLine[] = []

  const prevIds = new Set<string>()
  for (const column of COLUMNS) {
    for (const item of column.select(prev)) prevIds.add(item.id)
  }

  for (const column of COLUMNS) {
    const fresh = column.select(next).filter((item) => !prevIds.has(item.id))
    if (fresh.length === 0) continue
    // One line per column: a single arrival is named, a batch is counted.
    const first = fresh[0]
    if (!first) continue
    lines.push({
      tone: 'info',
      message:
        fresh.length === 1
          ? `${column.title}: ${first.repo.nameWithOwner}#${first.number}`
          : `${fresh.length} new in ${column.title}`,
      itemId: first.id,
    })
  }

  return lines
}

/**
 * Watches the poll stream and surfaces changes: as toasts while you are
 * looking at the board, as one batched desktop notification per poll when you
 * are not. Renders nothing.
 */
export function BoardAlerts({ data, enabled, onFocusItem }: BoardAlertsProps) {
  const toast = useToast()
  const prevRef = useRef<DashboardData | null>(null)

  useEffect(() => {
    if (!data) return
    // A failed poll re-serves the last good columns with `error` set; keeping
    // the old baseline means recovery diffs against reality, not itself.
    if (data.error) return
    const prev = prevRef.current
    // The baseline always advances, even while alerts are off, so flipping the
    // bell on never replays history.
    prevRef.current = data
    if (!prev || prev.fetchedAt === data.fetchedAt) return
    if (!enabled) return

    const lines = diffBoard(prev, data)
    if (lines.length === 0) return

    const canNotify = typeof Notification !== 'undefined' && Notification.permission === 'granted'
    if (document.visibilityState === 'visible' || !canNotify) {
      for (const line of lines) toast(line.message, line.tone)
      return
    }

    // One notification per poll, replacing the previous one (tag) rather than
    // piling up in Notification Center while you are away.
    const notification = new Notification('shazam', {
      body: lines.map((line) => line.message).join('\n'),
      tag: 'shazam-board',
    })
    notification.onclick = () => {
      window.focus()
      const first = lines[0]
      if (first) onFocusItem(first.itemId)
      notification.close()
    }
  }, [data, enabled, toast, onFocusItem])

  return null
}
