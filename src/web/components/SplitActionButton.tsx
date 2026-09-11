import { ChevronDownIcon } from '@radix-ui/react-icons'
import { Button, DropdownMenu, Flex, Tooltip } from '@radix-ui/themes'
import type { ComponentProps, ReactNode } from 'react'

type ButtonColor = ComponentProps<typeof Button>['color']

export interface SplitActionButtonProps {
  label: string
  /** Rendered after the label, for a state marker like a pending-checks "!". */
  suffix?: ReactNode
  color: ButtonColor
  /** Shown on the primary half, which acts immediately with no confirmation. */
  primaryTooltip: string
  busy?: boolean
  /** When set the button is inert and the text explains why. */
  blockedReason?: string | null
  onPrimary: () => void
  menu: { label: string; onSelect: () => void }[]
}

/**
 * The primary half commits straight away - these are all reversible on GitHub,
 * and a confirmation on every one made the common path slow. Anything that
 * wants a comment first lives behind the caret.
 */
export function SplitActionButton({
  label,
  suffix,
  color,
  primaryTooltip,
  busy,
  blockedReason,
  onPrimary,
  menu,
}: SplitActionButtonProps) {
  if (blockedReason) {
    return (
      <Tooltip content={blockedReason}>
        <Button size="1" variant="soft" color="gray" disabled>
          {label}
        </Button>
      </Tooltip>
    )
  }

  return (
    <Flex className="split-button">
      <Tooltip content={primaryTooltip}>
        <Button
          size="1"
          variant="soft"
          color={color}
          loading={busy}
          onClick={onPrimary}
          className="split-main"
        >
          {label}
          {suffix}
        </Button>
      </Tooltip>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Button
            size="1"
            variant="soft"
            color={color}
            disabled={busy}
            className="split-caret"
            aria-label={`More ${label.toLowerCase()} options`}
          >
            <ChevronDownIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content size="1">
          {menu.map((item) => (
            <DropdownMenu.Item key={item.label} onSelect={item.onSelect}>
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Flex>
  )
}
