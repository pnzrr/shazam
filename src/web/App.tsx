import {
  ExclamationTriangleIcon,
  GitHubLogoIcon,
  MoonIcon,
  ReloadIcon,
  SunIcon,
} from '@radix-ui/react-icons'
import { Callout, Flex, Heading, IconButton, Text, Theme, Tooltip } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentSession, DashboardItem } from '../shared/types.js'
import './app.css'
import { DashboardColumn } from './components/DashboardColumn.js'
import { FilterChips } from './components/FilterChips.js'
import { TerminalDock } from './components/TerminalDock.js'
import { Toaster } from './components/Toaster.js'
import { TokenGate } from './components/TokenGate.js'
import { COLUMNS } from './components/columns/index.js'
import type { ColumnContext } from './components/registry.js'
import { ownerOf } from './components/registry.js'
import { useDashboard } from './hooks/useDashboard.js'
import { useHealth } from './hooks/useHealth.js'
import { useSessions } from './hooks/useSessions.js'
import { useAppearance } from './lib/appearance.js'
import { relativeTime } from './lib/format.js'

const FILTER_KEY = 'shazam.owners'

/**
 * How long a row stays hidden after you act on it. Long enough for GitHub's
 * search index to catch up, short enough that a no-op action self-corrects.
 */
const DISMISS_MS = 90_000

function loadFilter(): Set<string> {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function App() {
  const [appearance, toggleAppearance] = useAppearance()
  const health = useHealth()
  const dashboard = useDashboard(health?.pollIntervalMs ?? 60_000)
  const sessions = useSessions()
  const [owners, setOwners] = useState<Set<string>>(loadFilter)
  // Which tile you last touched, so you can find your place after coming back
  // from GitHub or an agent session. Deliberately not persisted: it is a marker
  // for the current sitting, not a saved selection.
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)
  /**
   * Rows hidden because you just acted on them. A refresh is not enough on its
   * own: GitHub's search index lags, so an approved PR keeps matching
   * `-reviewed-by:@me` for a while and would sit there looking untouched.
   * Entries expire, so anything the action did not actually remove comes back.
   */
  const [dismissed, setDismissed] = useState<Map<string, number>>(new Map())

  const persistOwners = useCallback((next: Set<string>) => {
    setOwners(next)
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify([...next]))
    } catch {
      // storage disabled
    }
  }, [])

  const toggleOwner = useCallback(
    (owner: string) => {
      const next = new Set(owners)
      if (next.has(owner)) next.delete(owner)
      else next.add(owner)
      persistOwners(next)
    },
    [owners, persistOwners],
  )

  const data = dashboard.data

  useEffect(() => {
    if (dismissed.size === 0) return
    const now = Date.now()
    const live = [...dismissed].filter(([, expiry]) => expiry > now)
    if (live.length !== dismissed.size) setDismissed(new Map(live))
  }, [data, dismissed])

  const ownerCounts = useMemo(() => {
    if (!data) return []
    const counts = new Map<string, number>()
    for (const column of COLUMNS) {
      for (const item of column.select(data)) {
        counts.set(ownerOf(item), (counts.get(ownerOf(item)) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner))
  }, [data])

  const ctx: ColumnContext = useMemo(
    () => ({
      viewer: data?.viewer ?? '',
      agents: health?.agents ?? [],
      defaultMergeMethod: health?.defaultMergeMethod ?? 'squash',
      defaultAgent: health?.defaultAgent ?? 'claude',
      onSessionLaunched: (session: AgentSession) => sessions.add(session),
      onActioned: (itemId: string) => {
        setDismissed((current) => new Map(current).set(itemId, Date.now() + DISMISS_MS))
        void dashboard.refresh()
      },
      onChanged: () => void dashboard.refresh(),
      lastClickedId,
      onTileClicked: setLastClickedId,
    }),
    [
      data?.viewer,
      health?.agents,
      health?.defaultMergeMethod,
      health?.defaultAgent,
      sessions,
      dashboard,
      lastClickedId,
    ],
  )

  const filter = (items: DashboardItem[]) => {
    const visible = items.filter((item) => !dismissed.has(item.id))
    return owners.size === 0 ? visible : visible.filter((item) => owners.has(ownerOf(item)))
  }

  if (dashboard.unauthorized) {
    return (
      <Theme appearance={appearance} accentColor="indigo" grayColor="slate" radius="medium">
        <TokenGate />
      </Theme>
    )
  }

  const toolWarnings = (health?.tools ?? []).filter((tool) => tool.status !== 'ok')

  return (
    <Theme appearance={appearance} accentColor="indigo" grayColor="slate" radius="medium">
      <Toaster>
        <Flex direction="column" className="app">
          <Flex align="center" gap="3" px="4" py="3" className="header">
            <GitHubLogoIcon width="20" height="20" />
            <Heading size="4">shazam</Heading>
            {data?.viewer ? (
              <Text size="2" color="gray">
                {data.viewer}
              </Text>
            ) : null}

            <Flex flexGrow="1" justify="center">
              <FilterChips
                owners={ownerCounts}
                selected={owners}
                onToggle={toggleOwner}
                onClear={() => persistOwners(new Set())}
              />
            </Flex>

            {data?.rateLimit ? (
              <Tooltip
                content={`GitHub API: ${data.rateLimit.remaining} of ${data.rateLimit.limit} left, resets ${relativeTime(data.rateLimit.resetAt)}`}
              >
                <Text size="1" color="gray">
                  {data.rateLimit.remaining}
                </Text>
              </Tooltip>
            ) : null}

            {data ? (
              <Text size="1" color="gray">
                {relativeTime(data.fetchedAt)}
              </Text>
            ) : null}

            <Tooltip content="Refresh now">
              <IconButton
                size="2"
                variant="ghost"
                color="gray"
                loading={dashboard.refreshing}
                onClick={() => void dashboard.refresh()}
              >
                <ReloadIcon />
              </IconButton>
            </Tooltip>

            <Tooltip content={appearance === 'dark' ? 'Switch to light' : 'Switch to dark'}>
              <IconButton size="2" variant="ghost" color="gray" onClick={toggleAppearance}>
                {appearance === 'dark' ? <SunIcon /> : <MoonIcon />}
              </IconButton>
            </Tooltip>
          </Flex>

          {dashboard.error || data?.error || toolWarnings.length > 0 ? (
            <Flex direction="column" gap="1" px="4" pb="2">
              {dashboard.error ? (
                <Callout.Root color="red" size="1" variant="surface">
                  <Callout.Icon>
                    <ExclamationTriangleIcon />
                  </Callout.Icon>
                  <Callout.Text>Cannot reach the shazam server: {dashboard.error}</Callout.Text>
                </Callout.Root>
              ) : null}
              {data?.error ? (
                <Callout.Root color="red" size="1" variant="surface">
                  <Callout.Icon>
                    <ExclamationTriangleIcon />
                  </Callout.Icon>
                  <Callout.Text>Last poll failed: {data.error}</Callout.Text>
                </Callout.Root>
              ) : null}
              {toolWarnings.map((tool) => (
                <Callout.Root key={tool.name} color="amber" size="1" variant="surface">
                  <Callout.Icon>
                    <ExclamationTriangleIcon />
                  </Callout.Icon>
                  <Callout.Text>
                    {tool.name}: {tool.detail ?? tool.status}
                  </Callout.Text>
                </Callout.Root>
              ))}
            </Flex>
          ) : null}

          <Flex gap="3" px="4" pb="3" className="grid">
            {COLUMNS.map((column) => {
              const all = data ? column.select(data) : []
              const items = filter(all)
              return (
                <DashboardColumn
                  key={column.id}
                  column={column}
                  items={items}
                  hiddenCount={all.length - items.length}
                  ctx={ctx}
                />
              )
            })}
          </Flex>

          <TerminalDock
            sessions={sessions.sessions}
            activeId={sessions.activeId}
            appearance={appearance}
            onSelect={sessions.setActiveId}
            onClose={(id) => void sessions.close(id)}
            fontSize={health?.terminalFontSize ?? 20}
            onStatus={(session) => sessions.update(session)}
          />
        </Flex>
      </Toaster>
    </Theme>
  )
}
