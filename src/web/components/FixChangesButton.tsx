import { Loader2, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AgentId, AgentSession, PullRequestItem } from '../../shared/types.js'
import { api } from '../lib/api.js'
import { type AgentInfo, primaryAgent } from './agents.js'
import { useToast } from './Toaster.js'

export interface FixChangesButtonProps {
  pr: PullRequestItem
  agents: AgentInfo[]
  defaultAgent: AgentId
  onLaunched: (session: AgentSession) => void
}

/**
 * Sits beside the "changes" chip and opens the same worktree Shazam would,
 * with the agent pointed at the review instead of asked to read and wait.
 * Rendered only where there is something to answer, so its presence on a tile
 * is itself the signal that a reviewer is waiting on you.
 */
export function FixChangesButton({ pr, agents, defaultAgent, onLaunched }: FixChangesButtonProps) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const agent = primaryAgent(agents, defaultAgent)
  // Nothing to open it with; the Shazam button already explains why.
  if (!agent) return null

  const launch = async () => {
    setBusy(true)
    try {
      const session = await api.shazam(pr, agent.id, 'address')
      onLaunched(session)
      toast(`Shazam: answering review on ${pr.repo.nameWithOwner}#${pr.number}`, 'info')
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
          aria-label={`Open ${agent.label} on the changes requested for #${pr.number}`}
          onClick={() => void launch()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Wrench className="size-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{`Open ${agent.label} on the requested changes - fix or challenge, and reply`}</TooltipContent>
    </Tooltip>
  )
}
