import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AgentSession } from '../../shared/types.js'
import { CHIP_SOLID, type ChipColor } from './chips.js'
import { TerminalPane } from './TerminalPane.js'

const MIN_HEIGHT = 140
/** Leave at least this much of the lists visible above the dock. */
const MIN_LISTS_VISIBLE = 160

/** A new session opens the dock across the bottom half of the window. */
const halfWindow = () => Math.round(window.innerHeight / 2)

const STATUS_COLOR: Record<AgentSession['status'], Exclude<ChipColor, 'orange'>> = {
  preparing: 'amber',
  running: 'green',
  exited: 'gray',
  failed: 'red',
}

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
    <div
      className="flex min-h-0 shrink-0 flex-col border-t bg-card"
      style={{ height: collapsed ? undefined : height }}
    >
      <div
        className="-mt-[3px] h-[5px] shrink-0 cursor-ns-resize"
        onPointerDown={() => {
          if (collapsed) return
          dragging.current = true
          document.body.style.userSelect = 'none'
        }}
      />

      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              'flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5',
              session.id === active?.id ? 'bg-accent' : 'hover:bg-secondary',
            )}
            onClick={() => onSelect(session.id)}
          >
            <Badge className={CHIP_SOLID[STATUS_COLOR[session.status]]}>{session.agent}</Badge>
            <span className="text-xs">{session.title}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClose(session.id)
                  }}
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>End session</TooltipContent>
            </Tooltip>
          </div>
        ))}

        <div className="flex-1" />

        {active?.note ? (
          <span className="max-w-80 truncate text-xs text-muted-foreground">{active.note}</span>
        ) : null}
        {active?.worktreePath ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="max-w-80 truncate text-xs text-muted-foreground">
                {active.branch}
              </span>
            </TooltipTrigger>
            <TooltipContent>{active.worktreePath}</TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{collapsed ? 'Expand terminal' : 'Collapse terminal'}</TooltipContent>
        </Tooltip>
      </div>

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
    </div>
  )
}
