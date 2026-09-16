import { PrCard } from '../PrCard.js'
import type { ColumnDef } from '../registry.js'

export const approvedPrs: ColumnDef = {
  id: 'approvedPrs',
  title: 'Approved, awaiting merge',
  dot: 'bg-emerald-500',
  hint: 'You approved these and they have not merged yet',
  empty: 'Nothing you approved is waiting.',
  select: (data) => data.columns.approvedPrs,
  renderItem: (item, ctx) =>
    item.kind === 'pull_request' ? (
      // The merge action: your approval is in, so landing it is what is left.
      <PrCard key={item.id} pr={item} ctx={ctx} action="merge" />
    ) : null,
}
