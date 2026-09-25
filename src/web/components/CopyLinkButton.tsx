import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from './Toaster.js'

/** How long the tick stays up before the icon goes back to offering a copy. */
const CONFIRM_MS = 1400

export interface CopyLinkButtonProps {
  url: string
  /** What is being copied, for the tooltip and the screen reader label. */
  what: string
}

/**
 * Sits beside the title's external-link icon so the two readings of a title
 * are one click apart: open it, or take the URL somewhere else. Confirms by
 * swapping to a tick rather than raising a toast, because copying a link is
 * something you often do several times in a row.
 */
export function CopyLinkButton({ url, what }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toast = useToast()

  // The tile can be re-sorted out from under a pending tick by the next poll.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const copy = async (event: React.MouseEvent) => {
    // The whole card is a link to this same URL; copying is not opening.
    event.preventDefault()
    event.stopPropagation()

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), CONFIRM_MS)
    } catch (err) {
      // Denied permission, or no clipboard at all - say so rather than
      // leaving a button that looks like it worked.
      toast(`Could not copy: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          // `inline-flex` and `align-[-2px]` so it rides the last line of the
          // title next to the external-link icon, wrapping with the text
          // rather than sitting on a row of its own.
          className="ml-1 inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded align-[-3px] text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          aria-label={copied ? `Copied link to ${what}` : `Copy link to ${what}`}
          onClick={(event) => void copy(event)}
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-500" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? 'Copied' : 'Copy link'}</TooltipContent>
    </Tooltip>
  )
}
