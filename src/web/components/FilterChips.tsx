import { Badge, Flex, Text } from '@radix-ui/themes'

export interface FilterChipsProps {
  owners: { owner: string; count: number }[]
  selected: Set<string>
  onToggle: (owner: string) => void
  onClear: () => void
}

/**
 * Owner filter derived from whatever is currently on screen, so it needs no
 * configuration and adapts as the developer's orgs change.
 */
export function FilterChips({ owners, selected, onToggle, onClear }: FilterChipsProps) {
  if (owners.length < 2) return null

  return (
    <Flex gap="1" align="center" wrap="wrap">
      <Badge
        variant={selected.size === 0 ? 'solid' : 'soft'}
        color={selected.size === 0 ? undefined : 'gray'}
        radius="full"
        className="filter-chip"
        onClick={onClear}
      >
        All
      </Badge>
      {owners.map(({ owner, count }) => (
        <Badge
          key={owner}
          variant={selected.has(owner) ? 'solid' : 'soft'}
          color={selected.has(owner) ? undefined : 'gray'}
          radius="full"
          className="filter-chip"
          onClick={() => onToggle(owner)}
        >
          {owner}
          <Text size="1" color="gray" ml="1">
            {count}
          </Text>
        </Badge>
      ))}
    </Flex>
  )
}
