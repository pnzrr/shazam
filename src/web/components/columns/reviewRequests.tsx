import { PrCard } from '../PrCard.js'
import type { ColumnDef } from '../registry.js'

export const reviewRequests: ColumnDef = {
  id: 'reviewRequests',
  title: 'Waiting on my review',
  dot: 'bg-amber-500',
  hint: 'Review requested from you, and you have not reviewed yet',
  empty: 'No reviews waiting on you.',
  select: (data) => data.columns.reviewRequests,
  renderItem: (item, ctx) =>
    item.kind === 'pull_request' ? (
      <PrCard key={item.id} pr={item} ctx={ctx} action="approve" />
    ) : null,
}
