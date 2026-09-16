import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface FilterBarProps {
  value: string
  onChange: (value: string) => void
}

/**
 * The free-text/qualifier filter box. Parsing lives in lib/filter.ts; this is
 * only the input, its clear button, and the `/` shortcut to reach it.
 */
export function FilterBar({ value, onChange }: FilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      // Leave "/" alone while the user is typing somewhere else - a comment
      // box, a rename field, or the terminal (xterm types into a hidden
      // textarea, but the class check covers its canvas too).
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input, textarea, [contenteditable="true"], .xterm')) return
      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('')
            event.currentTarget.blur()
          }
        }}
        placeholder="Filter by keyword or by field"
        aria-label="Filter items"
        spellCheck={false}
        className="h-8 pr-8 pl-8 text-sm"
      />
      {value ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          aria-label="Clear filter"
          onClick={() => onChange('')}
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}
