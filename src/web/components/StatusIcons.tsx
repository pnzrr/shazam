import {
  ChatBubbleIcon,
  CheckCircledIcon,
  CircleBackslashIcon,
  ClockIcon,
  CrossCircledIcon,
  DotsHorizontalIcon,
  FileTextIcon,
  MinusCircledIcon,
  Pencil1Icon,
} from '@radix-ui/react-icons'
import { Badge, Flex, Text, Tooltip } from '@radix-ui/themes'
import type { ReactNode } from 'react'
import type { CheckState, MergeableState, ReviewDecision } from '../../shared/types.js'

interface ChipProps {
  tooltip: string
  color: React.ComponentProps<typeof Badge>['color']
  icon: ReactNode
  label?: string
  /** When set the chip becomes a link to the relevant GitHub tab. */
  href?: string
}

function Chip({ tooltip, color, icon, label, href }: ChipProps) {
  const badge = (
    <Badge color={color} variant="soft" radius="full" size="1">
      <Flex align="center" gap="1">
        {icon}
        {label ? <Text size="1">{label}</Text> : null}
      </Flex>
    </Badge>
  )

  if (!href) {
    return <Tooltip content={tooltip}>{badge}</Tooltip>
  }

  return (
    <Tooltip content={tooltip}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="chip-link"
        // The whole card is clickable; keep this chip's own destination.
        onClick={(event) => event.stopPropagation()}
      >
        {badge}
      </a>
    </Tooltip>
  )
}

export function ChecksChip({ state, prUrl }: { state: CheckState; prUrl?: string }) {
  const href = prUrl ? `${prUrl}/checks` : undefined
  switch (state) {
    case 'success':
      return (
        <Chip tooltip="All checks passing - open the checks tab" color="green" icon={<CheckCircledIcon />} href={href} />
      )
    case 'failure':
      return (
        <Chip tooltip="Checks failing - open the checks tab" color="red" icon={<CrossCircledIcon />} href={href} />
      )
    case 'pending':
      return (
        <Chip tooltip="Checks running - open the checks tab" color="amber" icon={<ClockIcon />} href={href} />
      )
    default:
      return <Chip tooltip="No checks reported" color="gray" icon={<MinusCircledIcon />} />
  }
}

export function ReviewChip({ decision }: { decision: ReviewDecision }) {
  switch (decision) {
    case 'approved':
      return <Chip tooltip="Approved" color="green" icon={<CheckCircledIcon />} label="approved" />
    case 'changes_requested':
      return <Chip tooltip="Changes requested" color="red" icon={<Pencil1Icon />} label="changes" />
    case 'review_required':
      return (
        <Chip tooltip="Review required" color="amber" icon={<DotsHorizontalIcon />} label="review" />
      )
    default:
      return null
  }
}

export function ConflictChip({ state, prUrl }: { state: MergeableState; prUrl?: string }) {
  if (state !== 'conflicting') return null
  return (
    <Chip
      tooltip="Has merge conflicts - open GitHub's conflict resolver"
      color="red"
      icon={<CircleBackslashIcon />}
      label="conflict"
      href={prUrl ? `${prUrl}/conflicts` : undefined}
    />
  )
}

export function CommentsChip({ count, threads = 0 }: { count: number; threads?: number }) {
  if (count === 0 && threads === 0) return null
  const tooltip =
    threads > 0
      ? `${count} comment${count === 1 ? '' : 's'}, ${threads} unresolved review thread${threads === 1 ? '' : 's'}`
      : `${count} comment${count === 1 ? '' : 's'}`
  return (
    <Chip
      tooltip={tooltip}
      color={threads > 0 ? 'orange' : 'gray'}
      icon={<ChatBubbleIcon />}
      label={String(threads > 0 ? threads : count)}
    />
  )
}

export function DraftChip({ isDraft }: { isDraft: boolean }) {
  if (!isDraft) return null
  return <Chip tooltip="Draft pull request" color="gray" icon={<FileTextIcon />} label="draft" />
}

export function DiffStat({
  additions,
  deletions,
  prUrl,
}: {
  additions: number
  deletions: number
  prUrl?: string
}) {
  const counts = (
    <Flex gap="1" align="center">
      <Text size="1" color="green">
        +{additions}
      </Text>
      <Text size="1" color="red">
        -{deletions}
      </Text>
    </Flex>
  )

  if (!prUrl) {
    return <Tooltip content={`+${additions} / -${deletions}`}>{counts}</Tooltip>
  }

  return (
    <Tooltip content={`+${additions} / -${deletions} - open the diff`}>
      <a
        href={`${prUrl}/files`}
        target="_blank"
        rel="noreferrer"
        className="chip-link"
        onClick={(event) => event.stopPropagation()}
      >
        {counts}
      </a>
    </Tooltip>
  )
}
