import { useEffect } from 'react'

/** The cursor only needs to know where a card is and where it leads. */
export interface BoardCursorItem {
  id: string
  url: string
}

/**
 * j/k keyboard cursor over the visible cards, plus Enter/o to open the
 * selection. There is no separate "keyboard selection" state: the cursor IS
 * lastClickedId, so a click and a keypress move the same marker and the card
 * shows the same ring either way - two selection mechanisms fighting over two
 * highlights would be worse than sharing one.
 */
export function useBoardKeys(
  items: BoardCursorItem[],
  selectedId: string | null,
  onSelect: (id: string) => void,
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key
      if (key !== 'j' && key !== 'k' && key !== 'o' && key !== 'Enter') return
      // Same guard the FilterBar uses for '/': leave keys alone while the user
      // is typing - the filter box, a comment box, a rename field, or the
      // terminal (xterm types into a hidden textarea; the class check covers
      // its canvas too).
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input, textarea, [contenteditable="true"], .xterm')) return
      // Enter on a focused button or link is activating that control, not
      // asking to open the selected card on top of it.
      if (key === 'Enter' && target?.closest('a, button, [role="menuitem"]')) return
      if (items.length === 0) return

      if (key === 'j' || key === 'k') {
        const index = selectedId ? items.findIndex((item) => item.id === selectedId) : -1
        // No selection yet (or it was filtered away): j starts at the top,
        // k at the bottom, so the first press always lands somewhere sensible.
        const next =
          index === -1
            ? key === 'j'
              ? 0
              : items.length - 1
            : Math.min(items.length - 1, Math.max(0, index + (key === 'j' ? 1 : -1)))
        const item = items[next]
        if (!item || item.id === selectedId) return
        event.preventDefault()
        onSelect(item.id)
        // The card is already in the DOM - only its ring changes on the next
        // render - so scrolling now is safe. inline too: the board scrolls
        // sideways, and the cursor crosses column boundaries.
        document
          .querySelector(`[data-item-id="${CSS.escape(item.id)}"]`)
          ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        return
      }

      const selected = selectedId ? items.find((item) => item.id === selectedId) : undefined
      if (!selected) return
      event.preventDefault()
      window.open(selected.url, '_blank', 'noopener,noreferrer')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [items, selectedId, onSelect])
}
