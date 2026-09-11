import { ChevronDownIcon, LightningBoltIcon } from '@radix-ui/react-icons'
import { Button, DropdownMenu, Flex, Tooltip } from '@radix-ui/themes'
import { useState } from 'react'
import type { AgentId, AgentSession, PullRequestItem } from '../../shared/types.js'
import { api } from '../lib/api.js'
import { useToast } from './Toaster.js'

export interface ShazamButtonProps {
  pr: PullRequestItem
  agents: { id: AgentId; label: string; available: boolean }[]
  onLaunched: (session: AgentSession) => void
}

/**
 * Split button: the primary half launches the first available agent, the
 * caret offers the rest. New agents come from the health report, so adding
 * one is a server-side change only.
 */
export function ShazamButton({ pr, agents, onLaunched }: ShazamButtonProps) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const available = agents.filter((a) => a.available)
  const primary = available[0]

  const launch = async (agent: AgentId) => {
    setBusy(true)
    try {
      const session = await api.shazam(pr, agent)
      onLaunched(session)
      toast(`Shazam: preparing ${pr.repo.nameWithOwner}#${pr.number}`, 'info')
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!primary) {
    return (
      <Tooltip content="Neither claude nor codex was found on PATH">
        <Button size="1" variant="soft" color="gray" disabled>
          <LightningBoltIcon /> Shazam
        </Button>
      </Tooltip>
    )
  }

  return (
    <Flex className="split-button">
      <Tooltip content={`Clone a worktree for this PR and open ${primary.label}`}>
        <Button
          size="1"
          variant="solid"
          loading={busy}
          onClick={() => void launch(primary.id)}
          className="split-main"
        >
          <LightningBoltIcon /> Shazam
        </Button>
      </Tooltip>
      {available.length > 1 ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <Button size="1" variant="solid" disabled={busy} className="split-caret" aria-label="Choose agent">
              <ChevronDownIcon />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content size="1">
            {available.map((agent) => (
              <DropdownMenu.Item key={agent.id} onSelect={() => void launch(agent.id)}>
                Open in {agent.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      ) : null}
    </Flex>
  )
}
