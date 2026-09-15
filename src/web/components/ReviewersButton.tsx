import {
  CheckCircledIcon,
  ChatBubbleIcon,
  Cross2Icon,
  DotsHorizontalIcon,
  MinusCircledIcon,
  Pencil1Icon,
  PersonIcon,
  PlusIcon,
  UpdateIcon,
} from '@radix-ui/react-icons'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Popover,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  PullRequestItem,
  Reviewer,
  ReviewerCandidate,
  ReviewerState,
  ReviewersPanel,
} from '../../shared/types.js'
import { api } from '../lib/api.js'
import { useToast } from './Toaster.js'

const STATE_LABEL: Record<ReviewerState, string> = {
  pending: 'waiting',
  approved: 'approved',
  changes_requested: 'changes',
  commented: 'commented',
  dismissed: 'dismissed',
}

const STATE_COLOR: Record<ReviewerState, React.ComponentProps<typeof Badge>['color']> = {
  pending: 'amber',
  approved: 'green',
  changes_requested: 'red',
  commented: 'gray',
  dismissed: 'gray',
}

const countPending = (panel: ReviewersPanel): number =>
  panel.reviewers.filter((r) => r.state === 'pending').length

function StateIcon({ state }: { state: ReviewerState }) {
  switch (state) {
    case 'approved':
      return <CheckCircledIcon />
    case 'changes_requested':
      return <Pencil1Icon />
    case 'commented':
      return <ChatBubbleIcon />
    case 'dismissed':
      return <MinusCircledIcon />
    default:
      return <DotsHorizontalIcon />
  }
}

function Person({ login, name, avatarUrl }: ReviewerCandidate) {
  return (
    <Flex gap="2" align="center" className="reviewer-person">
      <Avatar
        size="1"
        radius="full"
        src={avatarUrl ?? undefined}
        fallback={login.slice(0, 1).toUpperCase()}
      />
      <Text size="1" truncate>
        {login}
      </Text>
      {name ? (
        <Text size="1" color="gray" truncate>
          {name}
        </Text>
      ) : null}
    </Flex>
  )
}

export interface ReviewersButtonProps {
  pr: PullRequestItem
  /** Refreshes the dashboard; requesting a review changes the row's decision. */
  onChanged: () => void
}

/**
 * Who is on the pull request and who else could be. GitHub puts this in a
 * sidebar two clicks away, and it is the thing you want when a PR has sat for
 * a day: which of them has not looked yet, and who else could be asked.
 */
export function ReviewersButton({ pr, onChanged }: ReviewersButtonProps) {
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<ReviewersPanel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  /** The last count read straight from the PR, and the dashboard's number at
   *  the time, so we can tell when the dashboard has caught up. */
  const [observed, setObserved] = useState<{ pending: number; fromDashboard: number } | null>(null)
  const toast = useToast()
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const load = useCallback(
    async (q?: string) => {
      setLoading(true)
      try {
        const next = await api.reviewers(pr.repo.nameWithOwner, pr.number, q)
        if (!live.current) return
        setPanel(next)
        setObserved({
          pending: countPending(next),
          fromDashboard: pr.pendingReviewerCount,
        })
        setError(null)
      } catch (err) {
        if (!live.current) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (live.current) setLoading(false)
      }
    },
    [pr.repo.nameWithOwner, pr.number, pr.pendingReviewerCount],
  )

  useEffect(() => {
    if (open) void load()
    else {
      setQuery('')
      setPanel(null)
    }
    // `observed` deliberately survives a close; see the count below.
  }, [open, load])

  /**
   * The moment the poll disagrees with what we read, it has either caught up
   * or someone else has changed the reviewers - either way our reading is
   * spent, and dropping it here means a count that later churns back to the
   * same number cannot resurrect it.
   */
  useEffect(() => {
    setObserved((current) =>
      current && current.fromDashboard !== pr.pendingReviewerCount ? null : current,
    )
  }, [pr.pendingReviewerCount])

  /**
   * Collaborators come back a hundred at a time, which is the whole list for
   * most repositories, so typing filters what we already have. Only a repo
   * with more than that has to go back to GitHub for the rest.
   */
  useEffect(() => {
    if (!open || !panel?.truncated || query.trim().length < 2) return
    const timer = setTimeout(() => void load(query), 250)
    return () => clearTimeout(timer)
  }, [open, panel?.truncated, query, load])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return panel?.candidates ?? []
    return (panel?.candidates ?? []).filter(
      (c) =>
        c.login.toLowerCase().includes(needle) || (c.name ?? '').toLowerCase().includes(needle),
    )
  }, [panel?.candidates, query])

  const edit = async (add: string[], remove: string[], what: string) => {
    setBusy(add[0] ?? remove[0] ?? '')
    try {
      const result = await api.editReviewers(pr.url, add, remove)
      toast(result.ok ? what : result.message, result.ok ? 'success' : 'error')
      if (result.ok) {
        setQuery('')
        await load()
        onChanged()
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      if (live.current) setBusy(null)
    }
  }

  /**
   * The count on the card, in order of how much we trust it.
   *
   * The dashboard's number is only ever as fresh as the last poll: a minute
   * old at worst, and older than that whenever a poll fails, because the
   * poller keeps serving the last good payload behind its error banner. The
   * panel reads the pull request directly, so the moment it has told us the
   * truth we keep that number even after it closes - otherwise the count snaps
   * back to the stale one the instant you dismiss the thing that corrected it.
   *
   * The dashboard wins again as soon as its own number moves, which is how we
   * know it has caught up - or that someone else has changed the reviewers
   * since, which our reading would otherwise paper over indefinitely.
   */
  const pending = panel ? countPending(panel) : (observed?.pending ?? pr.pendingReviewerCount)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip
        content={
          pending > 0
            ? `${pending} reviewer${pending === 1 ? '' : 's'} have not answered yet - see who, or ask someone else`
            : 'Nobody is waiting to review - see who has looked, or ask someone'
        }
      >
        <Popover.Trigger>
          <Button size="1" variant="soft" color={pending > 0 ? 'amber' : 'gray'}>
            <PersonIcon />
            Request
            {pending > 0 ? <Text size="1" weight="bold">{pending}</Text> : null}
          </Button>
        </Popover.Trigger>
      </Tooltip>

      <Popover.Content size="1" side="top" align="end" className="reviewers-popover">
        <Flex direction="column" gap="3">
          <Flex align="center" justify="between" gap="3">
            <Text size="1" weight="medium">
              Reviewers
            </Text>
            {loading ? <Spinner size="1" /> : null}
          </Flex>

          {error ? (
            <Text size="1" color="red">
              {error}
            </Text>
          ) : null}

          {panel && panel.reviewers.length === 0 && !loading ? (
            <Text size="1" color="gray">
              Nobody has been asked yet.
            </Text>
          ) : null}

          {panel && panel.reviewers.length > 0 ? (
            <Flex direction="column" gap="1">
              {panel.reviewers.map((reviewer) => (
                <ReviewerRow
                  key={reviewer.login}
                  reviewer={reviewer}
                  busy={busy === reviewer.login}
                  onRemove={() => void edit([], [reviewer.login], `Removed ${reviewer.login}`)}
                  onReRequest={() =>
                    void edit([reviewer.login], [], `Asked ${reviewer.login} again`)
                  }
                />
              ))}
            </Flex>
          ) : null}

          {panel?.note ? (
            <Text size="1" color="gray">
              {panel.note}
            </Text>
          ) : (
            <Flex direction="column" gap="2">
              <TextField.Root
                size="1"
                placeholder="Add a reviewer…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
              <Box className="reviewers-scroll">
                {matches.length === 0 ? (
                  <Text size="1" color="gray">
                    {panel ? 'No collaborator matches that.' : ''}
                  </Text>
                ) : (
                  <Flex direction="column" gap="1">
                    {matches.map((candidate) => (
                      <button
                        key={candidate.login}
                        type="button"
                        className="reviewer-add"
                        disabled={busy !== null}
                        onClick={() =>
                          void edit([candidate.login], [], `Asked ${candidate.login} to review`)
                        }
                      >
                        <Person {...candidate} />
                        {busy === candidate.login ? <Spinner size="1" /> : <PlusIcon />}
                      </button>
                    ))}
                  </Flex>
                )}
              </Box>
            </Flex>
          )}
        </Flex>
      </Popover.Content>
    </Popover.Root>
  )
}

function ReviewerRow({
  reviewer,
  busy,
  onRemove,
  onReRequest,
}: {
  reviewer: Reviewer
  busy: boolean
  onRemove: () => void
  onReRequest: () => void
}) {
  return (
    <Flex align="center" justify="between" gap="2" className="reviewer-row">
      <Person login={reviewer.login} name={reviewer.name} avatarUrl={reviewer.avatarUrl} />
      <Flex align="center" gap="1" flexShrink="0">
        <Badge size="1" radius="full" color={STATE_COLOR[reviewer.state]}>
          <StateIcon state={reviewer.state} />
          {STATE_LABEL[reviewer.state]}
        </Badge>
        {busy ? <Spinner size="1" /> : null}
        {/* Someone who has already answered can be asked again - a review goes
            stale the moment you push, and this is GitHub's re-request arrow. */}
        {!busy && reviewer.state !== 'pending' ? (
          <Tooltip content={`Ask ${reviewer.login} to look again`}>
            <IconButton size="1" variant="ghost" color="gray" onClick={onReRequest}>
              <UpdateIcon />
            </IconButton>
          </Tooltip>
        ) : null}
        {!busy ? (
          <Tooltip content={`Remove ${reviewer.login}`}>
            <IconButton size="1" variant="ghost" color="gray" onClick={onRemove}>
              <Cross2Icon />
            </IconButton>
          </Tooltip>
        ) : null}
      </Flex>
    </Flex>
  )
}
