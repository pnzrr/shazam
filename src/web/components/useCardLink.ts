import type { MouseEvent } from 'react'
import { cn } from '@/lib/utils'

export interface CardLinkOptions {
  url: string
  /** Marks this tile as the one touched most recently. */
  isLastClicked: boolean
  /** Reported for any click inside the tile, not only ones that navigate. */
  onClicked: () => void
}

/**
 * Makes the whole card a click surface for `url` while leaving the controls
 * inside it alone. The tile's title is a real anchor, so it - not this - is the
 * accessible, keyboard-reachable, middle-clickable link; this only covers
 * clicks that land on the card's empty space, where there is no element to
 * activate. A click that was really a text selection is ignored.
 */
export function useCardLink({ url, isLastClicked, onClicked }: CardLinkOptions) {
  const shouldIgnore = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false
    return Boolean(target.closest('a, button, input, textarea, select, [role="menuitem"], [data-radix-popper-content-wrapper]'))
  }

  return {
    'aria-current': isLastClicked || undefined,
    // An inset ring hugs the card's real bounds whatever width we draw; the
    // `group` lets the title underline on any hover over the card. The tile
    // touched most recently keeps its 2px ring however it was touched.
    className: cn(
      'group cursor-pointer transition-shadow',
      isLastClicked
        ? 'ring-2 ring-primary ring-inset'
        : 'hover:ring-1 hover:ring-primary/60 hover:ring-inset',
    ),
    // Capture phase, so shazam, merge, approve, close, the deep-link chips and
    // the title anchor all mark the tile even though they handle the click
    // themselves and stop it reaching the card.
    onClickCapture: onClicked,
    onClick: (event: MouseEvent) => {
      if (shouldIgnore(event.target)) return
      if (window.getSelection()?.toString()) return
      window.open(url, '_blank', 'noopener,noreferrer')
    },
    // No key handler and no tabIndex here on purpose: the card is a mouse
    // convenience, and the title anchor is what keyboard users focus and
    // activate. Making the card a focusable role="link" too would nest the
    // buttons and chips inside a link.
  }
}
