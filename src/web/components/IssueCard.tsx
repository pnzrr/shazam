import { ExternalLinkIcon } from '@radix-ui/react-icons'
import { Badge, Card, Flex, Link, Text, Tooltip } from '@radix-ui/themes'
import type { IssueItem } from '../../shared/types.js'
import { absoluteTime, relativeTime } from '../lib/format.js'
import { CloseIssueButton } from './CloseIssueButton.js'
import { CommentsChip } from './StatusIcons.js'
import { useCardLink } from './useCardLink.js'
import type { ColumnContext } from './registry.js'

/**
 * GitHub label colors are authored against a solid swatch, so using one as text
 * color leaves pastels unreadable on a light background. Fill the badge and
 * pick the text color by luminance, the way GitHub itself does.
 */
function labelColors(hex: string): { background: string; color: string } {
  const value = Number.parseInt(hex, 16)
  if (!Number.isFinite(value) || hex.length !== 6) {
    return { background: 'var(--gray-a4)', color: 'var(--gray-12)' }
  }
  const r = (value >> 16) & 0xff
  const g = (value >> 8) & 0xff
  const b = value & 0xff
  // Rec. 709 relative luminance, the usual threshold for this decision.
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return { background: `#${hex}`, color: luminance > 0.6 ? '#1c2024' : '#ffffff' }
}

export function IssueCard({ issue, ctx }: { issue: IssueItem; ctx: ColumnContext }) {
  const link = useCardLink({
    url: issue.url,
    isLastClicked: ctx.lastClickedId === issue.id,
    onClicked: () => ctx.onTileClicked(issue.id),
  })

  return (
    <Card size="1" {...link}>
      <Flex direction="column" gap="2">
        <Flex justify="between" align="start" gap="2">
          <Flex direction="column" gap="1" className="row-heading">
            <Text size="1" color="gray">
              {issue.repo.nameWithOwner} #{issue.number}
              {issue.author && issue.author !== ctx.viewer ? ` · ${issue.author}` : ''}
            </Text>
            <Link
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              size="2"
              weight="medium"
              className="row-title"
            >
              {issue.title} <ExternalLinkIcon className="inline-icon" />
            </Link>
          </Flex>
          <Tooltip content={absoluteTime(issue.updatedAt)}>
            <Text size="1" color="gray" className="row-time">
              {relativeTime(issue.updatedAt)}
            </Text>
          </Tooltip>
        </Flex>

        <Flex gap="2" align="center" wrap="wrap">
          <CommentsChip count={issue.commentCount} />
          {issue.labels.slice(0, 3).map((label) => (
            <Badge key={label.name} size="1" radius="full" style={labelColors(label.color)}>
              {label.name}
            </Badge>
          ))}
        </Flex>

        <Flex gap="2" align="center" justify="end">
          <CloseIssueButton issue={issue} onDone={() => ctx.onActioned(issue.id)} />
        </Flex>
      </Flex>
    </Card>
  )
}
