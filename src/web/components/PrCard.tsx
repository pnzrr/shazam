import { ExternalLinkIcon } from '@radix-ui/react-icons'
import { Card, Flex, Link, Text, Tooltip } from '@radix-ui/themes'
import type { AgentSession, PullRequestItem } from '../../shared/types.js'
import { absoluteTime, relativeTime } from '../lib/format.js'
import { ApproveButton } from './ApproveButton.js'
import { MergeButton } from './MergeButton.js'
import { ShazamButton } from './ShazamButton.js'
import {
  ChecksChip,
  CommentsChip,
  ConflictChip,
  DiffStat,
  DraftChip,
  ReviewChip,
} from './StatusIcons.js'
import { useCardLink } from './useCardLink.js'
import type { ColumnContext } from './registry.js'

export interface PrCardProps {
  pr: PullRequestItem
  ctx: ColumnContext
  /** Which primary action this column offers alongside shazam. */
  action: 'merge' | 'approve' | 'none'
}

export function PrCard({ pr, ctx, action }: PrCardProps) {
  const onLaunched = (session: AgentSession) => ctx.onSessionLaunched(session)
  const link = useCardLink({
    url: pr.url,
    isLastClicked: ctx.lastClickedId === pr.id,
    onClicked: () => ctx.onTileClicked(pr.id),
  })

  return (
    <Card size="1" {...link}>
      <Flex direction="column" gap="2">
        <Flex justify="between" align="start" gap="2">
          <Flex direction="column" gap="1" className="row-heading">
            <Text size="1" color="gray">
              {pr.repo.nameWithOwner} #{pr.number}
              {pr.author && pr.author !== ctx.viewer ? ` · ${pr.author}` : ''}
            </Text>
            <Link
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              size="2"
              weight="medium"
              className="row-title"
            >
              {pr.title} <ExternalLinkIcon className="inline-icon" />
            </Link>
          </Flex>
          <Tooltip content={absoluteTime(pr.updatedAt)}>
            <Text size="1" color="gray" className="row-time">
              {relativeTime(pr.updatedAt)}
            </Text>
          </Tooltip>
        </Flex>

        <Flex gap="2" align="center" wrap="wrap">
          <DraftChip isDraft={pr.isDraft} />
          <ChecksChip state={pr.checks} prUrl={pr.url} />
          <ReviewChip decision={pr.reviewDecision} />
          <ConflictChip state={pr.mergeable} prUrl={pr.url} />
          <CommentsChip count={pr.commentCount} threads={pr.unresolvedThreadCount} />
          <DiffStat additions={pr.additions} deletions={pr.deletions} prUrl={pr.url} />
        </Flex>

        <Flex gap="2" align="center" justify="end">
          <ShazamButton pr={pr} agents={ctx.agents} onLaunched={onLaunched} />
          {action === 'merge' ? (
            <MergeButton pr={pr} defaultMethod={ctx.defaultMergeMethod} onDone={() => ctx.onActioned(pr.id)} />
          ) : null}
          {action === 'approve' ? <ApproveButton pr={pr} onDone={() => ctx.onActioned(pr.id)} /> : null}
        </Flex>
      </Flex>
    </Card>
  )
}
