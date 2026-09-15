import { IconButton, Tooltip } from '@radix-ui/themes'
import { useState } from 'react'
import type { AgentId, AgentSession, PullRequestItem } from '../../shared/types.js'
import { api } from '../lib/api.js'
import { type AgentInfo, primaryAgent } from './agents.js'
import { useToast } from './Toaster.js'

/**
 * Radix's icon set has no wrench, and this is the one place the dashboard
 * needs one, so it is drawn here to the same 15x15 grid and currentColor
 * convention as the icons it sits beside.
 */
function WrenchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {/* Open jaw, then the handle running down to the opposite corner. */}
      <path d="M9.9 1.6a3.6 3.6 0 0 0-3.2 5.3l-4.6 4.6a1.5 1.5 0 0 0 2.1 2.1l4.6-4.6a3.6 3.6 0 0 0 4.5-4.7l-2 2-1.9-.5-.5-1.9 2-2a3.6 3.6 0 0 0-1-.3Z" />
    </svg>
  )
}

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
    <Tooltip content={`Open ${agent.label} on the requested changes - fix or challenge, and reply`}>
      <IconButton
        size="1"
        variant="solid"
        radius="full"
        loading={busy}
        className="wrench-chip"
        aria-label={`Open ${agent.label} on the changes requested for #${pr.number}`}
        onClick={() => void launch()}
      >
        <WrenchIcon />
      </IconButton>
    </Tooltip>
  )
}
