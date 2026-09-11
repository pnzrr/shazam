import { ChevronDownIcon, ChevronUpIcon, Cross2Icon } from '@radix-ui/react-icons'
import { Badge, Flex, IconButton, Text, Tooltip } from '@radix-ui/themes'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentSession } from '../../shared/types.js'
import { TerminalPane } from './TerminalPane.js'

const MIN_HEIGHT = 140
/** Leave at least this much of the lists visible above the dock. */
const MIN_LISTS_VISIBLE = 160

/** A new session opens the dock across the bottom half of the window. */
const halfWindow = () => Math.round(window.innerHeight / 2)

const STATUS_COLOR = {
  preparing: 'amber',
  running: 'green',
  exited: 'gray',
  failed: 'red',
} as const

export interface TerminalDockProps {
  sessions: AgentSession[]
  activeId: string | null
  appearance: 'light' | 'dark'
  fontSize: number
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onStatus: (session: AgentSession) => void
}

export function TerminalDock({
  sessions,
  activeId,
  appearance,
  fontSize,
  onSelect,
  onClose,
  onStatus,
}: TerminalDockProps) {
  const [height, setHeight] = useState(halfWindow)
  const [collapsed, setCollapsed] = useState(false)
  const dragging = useRef(false)
  const seen = useRef(new Set<string>())

  const clamp = useCallback(
    (value: number) =>
      Math.max(MIN_HEIGHT, Math.min(value, window.innerHeight - MIN_LISTS_VISIBLE)),
    [],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging.current) return
      // Dock is anchored to the bottom, so height grows as the pointer rises.
      setHeight(clamp(window.innerHeight - event.clientY))
    },
    [clamp],
  )

  useEffect(() => {
    const stop = () => {
      dragging.current = false
      document.body.style.userSelect = ''
    }
    // A shorter window must not leave the dock taller than the screen.
    const onResize = () => setHeight((current) => clamp(current))

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('resize', onResize)
    }
  }, [onPointerMove, clamp])

  // A freshly launched session opens the dock to half the window, whatever the
  // dock was doing before, so you can see the agent working straight away.
  const ids = sessions.map((s) => s.id).join(',')
  useEffect(() => {
    const fresh = sessions.filter((s) => !seen.current.has(s.id))
    for (const s of sessions) seen.current.add(s.id)
    if (fresh.length === 0) return
    setCollapsed(false)
    setHeight(clamp(halfWindow()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, clamp])

  if (sessions.length === 0) return null

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]

  return (
    <Flex direction="column" className="dock" style={{ height: collapsed ? undefined : height }}>
      <div
        className="dock-resizer"
        onPointerDown={() => {
          if (collapsed) return
          dragging.current = true
          document.body.style.userSelect = 'none'
        }}
      />

      <Flex align="center" gap="1" px="2" py="1" className="dock-tabs">
        {sessions.map((session) => (
          <Flex
            key={session.id}
            align="center"
            gap="1"
            className={`dock-tab${session.id === active?.id ? ' is-active' : ''}`}
            onClick={() => onSelect(session.id)}
          >
            <Badge color={STATUS_COLOR[session.status]} variant="solid" radius="full" size="1">
              {session.agent}
            </Badge>
            <Text size="1">{session.title}</Text>
            <Tooltip content="End session">
              <IconButton
                size="1"
                variant="ghost"
                color="gray"
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(session.id)
                }}
              >
                <Cross2Icon />
              </IconButton>
            </Tooltip>
          </Flex>
        ))}

        <Flex flexGrow="1" />

        {active?.note ? (
          <Text size="1" color="gray" className="dock-note">
            {active.note}
          </Text>
        ) : null}
        {active?.worktreePath ? (
          <Tooltip content={active.worktreePath}>
            <Text size="1" color="gray" className="dock-note">
              {active.branch}
            </Text>
          </Tooltip>
        ) : null}

        <Tooltip content={collapsed ? 'Expand terminal' : 'Collapse terminal'}>
          <IconButton size="1" variant="ghost" color="gray" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </IconButton>
        </Tooltip>
      </Flex>

      {!collapsed && active ? (
        <TerminalPane
          key={active.id}
          session={active}
          appearance={appearance}
          // The pane refits when this changes; a drag or a window resize would
          // otherwise only reach it through ResizeObserver.
          height={height}
          fontSize={fontSize}
          onStatus={onStatus}
        />
      ) : null}
    </Flex>
  )
}
