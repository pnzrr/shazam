import DOMPurify from 'dompurify'
import { CircleCheck, ExternalLink, Loader2, Pencil } from 'lucide-react'
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { CommentItem, CommentThread } from '../../shared/types.js'
import { api } from '../lib/api.js'
import { absoluteTime, relativeTime } from '../lib/format.js'
import { CHIP_SOFT } from './chips.js'

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
        className={CHIP_SOFT[comment.isResolved ? 'gray' : 'orange']}
        title={comment.isResolved ? `${path} (resolved)` : path}
      >
        {path.split('/').pop()}
      </Badge>
    )
  }
  switch (comment.reviewState) {
    case 'approved':
      return (
        <Badge className={CHIP_SOFT.green}>
          <CircleCheck /> approved
        </Badge>
      )
    case 'changes_requested':
      return (
        <Badge className={CHIP_SOFT.red}>
          <Pencil /> changes
        </Badge>
      )
    case 'dismissed':
      return <Badge className={CHIP_SOFT.gray}>dismissed</Badge>
    default:
      return null
  }
}

function Comment({ comment }: { comment: CommentItem }) {
  const html = useMemo(() => sanitize(comment.bodyHtml), [comment.bodyHtml])

  return (
    <div className="flex items-start gap-2">
      <Avatar className="size-5">
        <AvatarImage src={comment.avatarUrl ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {(comment.author ?? '?').slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{comment.author ?? 'ghost'}</span>
          {/* The timestamp is the deep link: every comment has its own anchor
              on GitHub, and this is the one place a row's individual comments
              are listed, so it is where "take me to that one" belongs.
              Underlined only on hover: in a list of a dozen comments the
              timestamps are furniture, and permanently marking each one as a
              link would be the loudest thing in the overlay. */}
          <a
            href={comment.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground hover:underline"
            title={`${absoluteTime(comment.createdAt)} - open this comment on GitHub`}
          >
            {relativeTime(comment.createdAt)}
          </a>
          <ReviewBadge comment={comment} />
        </div>
        {html ? (
          // GitHub rendered this and sanitizes what it renders; `sanitize`
          // does it again here rather than trusting that across the wire.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized above
          <div className="comment-html" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span className="text-sm text-muted-foreground">(no description)</span>
        )}
      </div>
    </div>
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor virtualRef={anchor} />
      <PopoverTrigger
        ref={trigger}
        asChild
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
      </PopoverTrigger>
      <PopoverContent
        ref={content}
        side="bottom"
        align="start"
        sideOffset={8}
        // Half the window: comments carry code blocks and tables, and a narrow
        // column turns those into a horizontal scroll per paragraph.
        className="w-[50vw] min-w-80 max-w-[92vw] p-3"
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {thread ? `${thread.comments.length} comment${thread.comments.length === 1 ? '' : 's'}` : 'Comments'}
              {thread?.truncated ? ' (most recent)' : ''}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {repo}#{number} <ExternalLink className="inline size-3.5 align-[-2px] opacity-50" />
            </a>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading…</span>
            </div>
          ) : null}

          {error ? <span className="text-sm text-destructive">{error}</span> : null}

          {thread && thread.comments.length === 0 && !loading ? (
            <span className="text-sm text-muted-foreground">Nothing here yet.</span>
          ) : null}

          {thread && thread.comments.length > 0 ? (
            /* The list scrolls, not the popover: the header and its link out
               stay put while you read. Capped against the viewport so an
               overlay opened near the bottom of the screen is still a
               readable height. */
            <div className="max-h-[50vh] overflow-y-auto overscroll-contain pr-2">
              <div className="flex flex-col gap-3">
                {thread.comments.map((comment) => (
                  <Comment key={comment.id} comment={comment} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
