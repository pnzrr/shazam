import { CheckCircledIcon, ExternalLinkIcon, Pencil1Icon } from '@radix-ui/react-icons'
import { Avatar, Badge, Box, Flex, Link, Popover, Spinner, Text } from '@radix-ui/themes'
import DOMPurify from 'dompurify'
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import type { CommentItem, CommentThread } from '../../shared/types.js'
import { api } from '../lib/api.js'
import { absoluteTime, relativeTime } from '../lib/format.js'

interface ThreadState {
  loading: boolean
  error: string | null
  thread: CommentThread | null
}

const IDLE: ThreadState = { loading: false, error: null, thread: null }

/**
 * Every link in a comment leaves for GitHub. Without this they would navigate
 * the dashboard itself away, taking any running agent session's tab with it.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noreferrer')
  }
})

/**
 * GitHub gives us the comment already rendered - GFM and whatever HTML the
 * author wrote inline, which is how a Cloudflare Worker log or a <details>
 * block survives the trip. GitHub sanitizes what it renders, but this is
 * markup written by anyone who can comment on a repository we watch, so it is
 * sanitized again here before it goes anywhere near the document.
 */
function sanitize(html: string): string {
  if (!html.trim()) return ''
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }).trim()
}

/**
 * Fetches on open rather than on mount: a column holds a hundred rows and only
 * the one you click is worth a request. Refetches on every open, which is
 * cheap - the server holds each conversation briefly.
 */
function useThread(repo: string, number: number, open: boolean): ThreadState {
  const [state, setState] = useState<ThreadState>(IDLE)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setState({ loading: true, error: null, thread: null })

    api
      .comments(repo, number)
      .then((thread) => {
        if (!cancelled) setState({ loading: false, error: null, thread })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ loading: false, error: err instanceof Error ? err.message : String(err), thread: null })
      })

    return () => {
      cancelled = true
    }
  }, [repo, number, open])

  return open ? state : IDLE
}

function ReviewBadge({ comment }: { comment: CommentItem }) {
  if (comment.kind === 'review_comment') {
    // Just the file name: repository paths are long enough to push everything
    // else off the row, and the full one is a hover away.
    const path = comment.path ?? 'diff'
    return (
      <Badge
        size="1"
        radius="full"
        color={comment.isResolved ? 'gray' : 'orange'}
        title={comment.isResolved ? `${path} (resolved)` : path}
      >
        {path.split('/').pop()}
      </Badge>
    )
  }
  switch (comment.reviewState) {
    case 'approved':
      return (
        <Badge size="1" radius="full" color="green">
          <CheckCircledIcon /> approved
        </Badge>
      )
    case 'changes_requested':
      return (
        <Badge size="1" radius="full" color="red">
          <Pencil1Icon /> changes
        </Badge>
      )
    case 'dismissed':
      return (
        <Badge size="1" radius="full" color="gray">
          dismissed
        </Badge>
      )
    default:
      return null
  }
}

function Comment({ comment }: { comment: CommentItem }) {
  const html = useMemo(() => sanitize(comment.bodyHtml), [comment.bodyHtml])

  return (
    <Flex gap="2" className="comment" align="start">
      <Avatar
        size="1"
        radius="full"
        src={comment.avatarUrl ?? undefined}
        fallback={(comment.author ?? '?').slice(0, 1).toUpperCase()}
      />
      <Flex direction="column" gap="1" className="comment-body">
        <Flex gap="2" align="center" wrap="wrap">
          <Text size="1" weight="medium">
            {comment.author ?? 'ghost'}
          </Text>
          {/* The timestamp is the deep link: every comment has its own anchor
              on GitHub, and this is the one place a row's individual comments
              are listed, so it is where "take me to that one" belongs. */}
          <Link
            href={comment.url}
            target="_blank"
            rel="noreferrer"
            size="1"
            color="gray"
            // Underlined only on hover: in a list of a dozen comments the
            // timestamps are furniture, and permanently marking each one as a
            // link would be the loudest thing in the overlay.
            underline="hover"
            title={`${absoluteTime(comment.createdAt)} - open this comment on GitHub`}
          >
            {relativeTime(comment.createdAt)}
          </Link>
          <ReviewBadge comment={comment} />
        </Flex>
        {html ? (
          // GitHub rendered this and sanitizes what it renders; `sanitize`
          // does it again here rather than trusting that across the wire.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized above
          <div className="comment-html" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <Text size="1" color="gray">
            (no description)
          </Text>
        )}
      </Flex>
    </Flex>
  )
}

export interface CommentsPopoverProps {
  /** owner/name, for the lookup. */
  repo: string
  number: number
  /** The PR or issue, for the "open on GitHub" link. */
  url: string
  /** The chip that opens it. */
  children: ReactElement
}

/**
 * Shows a row's conversation over the dashboard instead of sending you to
 * GitHub for it. Anchored at the pointer, because the chip that opens it is
 * small and the eye is already there.
 */
export function CommentsPopover({ repo, number, url, children }: CommentsPopoverProps) {
  const [open, setOpen] = useState(false)
  const point = useRef<{ x: number; y: number } | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  // A virtual anchor: Radix positions against any object that can measure
  // itself, so the popover hangs off the pointer with no element in the DOM.
  // Opened from the keyboard there is no pointer, and the chip itself is what
  // the eye is on, so it anchors there instead.
  const anchor = useRef({
    getBoundingClientRect: () =>
      point.current
        ? new DOMRect(point.current.x, point.current.y, 0, 0)
        : (trigger.current?.getBoundingClientRect() ?? new DOMRect()),
  })
  const content = useRef<HTMLDivElement | null>(null)
  const { loading, error, thread } = useThread(repo, number, open)

  /**
   * While the overlay is up, the next click anywhere dismisses it and does
   * nothing else. Swallowing that click is the point: the dashboard is a field
   * of click targets, so a dismissal that fell through would open a tile on
   * GitHub - or press Merge, Approve or Close - on its way out.
   *
   * The exception is a link inside the overlay itself, which is its own way out
   * to GitHub. A click that only finished a text selection is not a dismissal.
   */
  useEffect(() => {
    if (!open) return

    const dismiss = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (content.current?.contains(target) && target.closest('a')) return
      if (window.getSelection()?.toString()) return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }

    // Next frame: the click that opened this is still being dispatched.
    const frame = requestAnimationFrame(() => {
      document.addEventListener('click', dismiss, true)
    })
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('click', dismiss, true)
    }
  }, [open])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Trigger
        ref={trigger}
        onPointerDown={(event) => {
          point.current = { x: event.clientX, y: event.clientY }
        }}
        // detail 0 is Enter or Space on a focused chip, which leaves the
        // pointer wherever it happened to be sitting.
        onClick={(event) => {
          if (event.detail === 0) point.current = null
        }}
      >
        {children}
      </Popover.Trigger>
      <Popover.Content
        ref={content}
        size="1"
        side="bottom"
        align="start"
        sideOffset={8}
        className="comments-popover"
        // Leave focus where it was: this opens under the pointer mid-scan, and
        // pulling focus into it would scroll the column out from under you.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // The listener above owns dismissal, so Radix's own must stand down
        // entirely. Its pointerdown is too early - the click that follows
        // would still land on whatever is underneath - and its focus rule
        // fired on the very click that opened this, because opening the
        // overlay moves focus to the chip, which is outside the content.
        // Escape still closes: that path is not routed through here.
        onInteractOutside={(event) => event.preventDefault()}
      >
        <Flex direction="column" gap="2">
          <Flex align="center" justify="between" gap="3">
            <Text size="1" color="gray">
              {thread ? `${thread.comments.length} comment${thread.comments.length === 1 ? '' : 's'}` : 'Comments'}
              {thread?.truncated ? ' (most recent)' : ''}
            </Text>
            <Link href={url} target="_blank" rel="noreferrer" size="1">
              {repo}#{number} <ExternalLinkIcon className="inline-icon" />
            </Link>
          </Flex>

          {loading ? (
            <Flex align="center" gap="2" py="2">
              <Spinner size="1" />
              <Text size="1" color="gray">
                Loading…
              </Text>
            </Flex>
          ) : null}

          {error ? (
            <Text size="1" color="red">
              {error}
            </Text>
          ) : null}

          {thread && thread.comments.length === 0 && !loading ? (
            <Text size="1" color="gray">
              Nothing here yet.
            </Text>
          ) : null}

          {thread && thread.comments.length > 0 ? (
            <Box className="comments-scroll">
              <Flex direction="column" gap="3">
                {thread.comments.map((comment) => (
                  <Comment key={comment.id} comment={comment} />
                ))}
              </Flex>
            </Box>
          ) : null}
        </Flex>
      </Popover.Content>
    </Popover.Root>
  )
}
