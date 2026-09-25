import { Loader2, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AgentId, AgentSession, PullRequestItem, ShazamIntent } from '../../shared/types.js'
import { api } from '../lib/api.js'
import { type AgentInfo, primaryAgent } from './agents.js'
import { useToast } from './Toaster.js'

export interface AgentFixButtonProps {
  pr: PullRequestItem
  agents: AgentInfo[]
  defaultAgent: AgentId
  onLaunched: (session: AgentSession) => void
}

interface WrenchProps extends AgentFixButtonProps {
  /** Which opening prompt the session gets. */
  intent: ShazamIntent
  /** Copy, given the agent's label, since every line of it names the agent. */
  describe: (agentLabel: string) => { tooltip: string; ariaLabel: string; toast: string }
}

/**
 * A wrench beside a chip: opens the same worktree Shazam would, with the agent
 * pointed at whatever that chip is complaining about rather than asked to read
 * and wait. Each one is rendered only where there is something to fix, so its
 * presence on a tile is itself the signal that the tile needs you.
 */
function AgentWrench({ pr, agents, defaultAgent, onLaunched, intent, describe }: WrenchProps) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const agent = primaryAgent(agents, defaultAgent)
  // Nothing to open it with; the Shazam button already explains why.
  if (!agent) return null

  const copy = describe(agent.label)

  const launch = async () => {
    setBusy(true)
    try {
      const session = await api.shazam(pr, agent.id, intent)
      onLaunched(session)
      toast(copy.toast, 'info')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A button among badges: it takes the chip row's height rather than a
            button's, and keeps the solid accent fill of the Shazam button it
            is a shortcut to. */}
        <Button
          size="icon-xs"
          className="size-6 shrink-0 rounded-full"
          disabled={busy}
          aria-label={copy.ariaLabel}
          onClick={() => void launch()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Wrench className="size-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copy.tooltip}</TooltipContent>
    </Tooltip>
  )
}

/** Beside the "changes" chip: answer the review. */
export function FixChangesButton(props: AgentFixButtonProps) {
  return (
    <AgentWrench
      {...props}
      intent="address"
      describe={(label) => ({
        tooltip: `Open ${label} on the requested changes - fix or challenge, and reply`,
        ariaLabel: `Open ${label} on the changes requested for #${props.pr.number}`,
        toast: `Shazam: answering review on ${props.pr.repo.nameWithOwner}#${props.pr.number}`,
      })}
    />
  )
}

/** Beside the "conflict" chip: resolve it, commit and push. */
export function FixConflictButton(props: AgentFixButtonProps) {
  return (
    <AgentWrench
      {...props}
      intent="conflict"
      describe={(label) => ({
        tooltip: `Open ${label} on the merge conflict - resolve it, commit and push`,
        ariaLabel: `Open ${label} on the merge conflict in #${props.pr.number}`,
        toast: `Shazam: resolving the conflict on ${props.pr.repo.nameWithOwner}#${props.pr.number}`,
      })}
    />
  )
}
