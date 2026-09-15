import { ExclamationTriangleIcon } from '@radix-ui/react-icons'
import { AlertDialog, Button, Callout, Flex, Select, Text, TextArea } from '@radix-ui/themes'
import { useState } from 'react'
import {
  type BlockingMergeState,
  type MergeMethod,
  type PullRequestItem,
  mergeStateBlocks,
} from '../../shared/types.js'
import { api } from '../lib/api.js'
import { SplitActionButton } from './SplitActionButton.js'
import { useToast } from './Toaster.js'

const METHODS: { value: MergeMethod; label: string }[] = [
  { value: 'squash', label: 'Squash and merge' },
  { value: 'merge', label: 'Create a merge commit' },
  { value: 'rebase', label: 'Rebase and merge' },
]

const METHOD_LABEL: Record<MergeMethod, string> = {
  squash: 'Squash and merge',
  merge: 'Merge commit',
  rebase: 'Rebase and merge',
}

const MERGE_STATE_REASON: Record<BlockingMergeState, string> = {
  blocked: 'GitHub is blocking this merge - something a branch rule requires has not passed',
  behind: 'The branch is behind its base, which this branch requires it not to be',
  dirty: 'Has merge conflicts',
  draft: 'This pull request is still a draft',
}

/**
 * CI that is not green deliberately does not block. A run still in progress may
 * yet pass, and a red one that no branch rule requires is one GitHub merges
 * without complaint - which is the common case for a lint or preview job. What
 * decides is `mergeState`, GitHub's own answer to "would you take this merge",
 * so a check that genuinely stands in the way comes back as `blocked`. Short of
 * that the button stays live and warns.
 */
function blockedReason(pr: PullRequestItem): string | null {
  if (pr.isDraft) return 'This pull request is still a draft'
  if (pr.reviewDecision !== 'approved') return 'Not approved yet'
  if (pr.mergeable === 'conflicting') return 'Has merge conflicts'
  if (mergeStateBlocks(pr.mergeState)) return MERGE_STATE_REASON[pr.mergeState]
  if (pr.allowedMergeMethods.length === 0) {
    return 'This repository has every merge method disabled'
  }
  return null
}

/**
 * Repositories can switch individual merge methods off, and gh fails outright
 * when asked for one that is disabled ("squash merges aren't allowed on this
 * repository"). Honour the configured preference when the repo permits it and
 * otherwise fall back to whatever it does allow.
 */
function effectiveMethod(pr: PullRequestItem, preferred: MergeMethod): MergeMethod {
  if (pr.allowedMergeMethods.includes(preferred)) return preferred
  return pr.allowedMergeMethods[0] ?? preferred
}

export interface MergeButtonProps {
  pr: PullRequestItem
  /** From config; the primary click uses it without asking. */
  defaultMethod: MergeMethod
  onDone: () => void
}

export function MergeButton({ pr, defaultMethod, onDone }: MergeButtonProps) {
  const usableMethod = effectiveMethod(pr, defaultMethod)
  const [method, setMethod] = useState<MergeMethod>(usableMethod)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const toast = useToast()

  const merge = async (withMethod: MergeMethod, comment?: string) => {
    setBusy(true)
    try {
      const result = await api.merge(pr.url, withMethod, comment)
      toast(
        result.ok ? `Merged ${pr.repo.nameWithOwner}#${pr.number}` : result.message,
        result.ok ? 'success' : 'error',
      )
      if (result.ok) {
        setOpen(false)
        setBody('')
        onDone()
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  // Amber for anything CI has not signed off on - failing as well as running.
  // Neither blocks any more, so the button is what has to say so.
  const checksRunning = pr.checks === 'pending'
  const checksRed = pr.checks === 'failure'
  const warn = checksRunning || checksRed

  return (
    <>
      <SplitActionButton
        label="Merge"
        suffix={
          warn ? (
            <Text weight="bold" aria-hidden>
              {' !'}
            </Text>
          ) : null
        }
        color={warn ? 'amber' : 'green'}
        primaryTooltip={
          warn
            ? `${checksRed ? 'Checks are failing' : 'Checks are still running'}, but no branch rule requires them - ${METHOD_LABEL[usableMethod].toLowerCase()} #${pr.number} anyway`
            : `${METHOD_LABEL[usableMethod]} #${pr.number} now`
        }
        busy={busy}
        blockedReason={blockedReason(pr)}
        onPrimary={() => void merge(usableMethod)}
        menu={[
          {
            label: 'Merge with comment…',
            onSelect: () => {
              setMethod(usableMethod)
              setOpen(true)
            },
          },
        ]}
      />

      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>
            Merge {pr.repo.nameWithOwner}#{pr.number}
          </AlertDialog.Title>
          <AlertDialog.Description size="2">{pr.title}</AlertDialog.Description>

          {warn ? (
            <Callout.Root color="amber" size="1" variant="surface" mt="3">
              <Callout.Icon>
                <ExclamationTriangleIcon />
              </Callout.Icon>
              <Callout.Text>
                {checksRed
                  ? 'CI checks are failing on this pull request. No branch rule requires them, so GitHub will take the merge.'
                  : 'CI checks are still running on this pull request.'}
              </Callout.Text>
            </Callout.Root>
          ) : null}

          <Flex direction="column" gap="2" mt="4">
            <Text size="2" weight="medium">
              Method
            </Text>
            <Select.Root value={method} onValueChange={(v) => setMethod(v as MergeMethod)}>
              <Select.Trigger />
              <Select.Content>
                {METHODS.filter((m) => pr.allowedMergeMethods.includes(m.value)).map((m) => (
                  <Select.Item key={m.value} value={m.value}>
                    {m.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>

          <Flex direction="column" gap="2" mt="3">
            <Text size="2" weight="medium">
              Commit message body
            </Text>
            <TextArea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Why this is going in"
              rows={3}
              autoFocus
            />
          </Flex>

          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button color="green" loading={busy} onClick={() => void merge(method, body)}>
              Merge
            </Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  )
}
