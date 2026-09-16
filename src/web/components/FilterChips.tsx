import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface FilterChipsProps {
  owners: { owner: string; count: number }[]
  selected: Set<string>
  onToggle: (owner: string) => void
  onClear: () => void
}

const chipClass = (active: boolean) =>
  cn(
    'cursor-pointer select-none',
    active ? '' : 'bg-secondary text-muted-foreground hover:bg-secondary/80',
  )

/**
 * Owner filter derived from whatever is currently on screen, so it needs no
 * configuration and adapts as the developer's orgs change.
 */
export function FilterChips({ owners, selected, onToggle, onClear }: FilterChipsProps) {
  if (owners.length < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge className={chipClass(selected.size === 0)} onClick={onClear}>
        All
      </Badge>
      {owners.map(({ owner, count }) => (
        <Badge key={owner} className={chipClass(selected.has(owner))} onClick={() => onToggle(owner)}>
          {owner}
          <span className={selected.has(owner) ? 'opacity-75' : 'text-muted-foreground'}>
            {count}
          </span>
        </Badge>
      ))}
    </div>
  )
}
