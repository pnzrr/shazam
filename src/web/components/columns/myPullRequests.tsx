import { PrCard } from '../PrCard.js'
import type { ColumnDef } from '../registry.js'

export const myPullRequests: ColumnDef = {
  id: 'myPullRequests',
  title: 'My pull requests',
  hint: 'Open PRs you authored, most recently updated first',
  empty: 'Nothing open. Enjoy it.',
  select: (data) => data.columns.myPullRequests,
  renderItem: (item, ctx) =>
    item.kind === 'pull_request' ? (
      <PrCard key={item.id} pr={item} ctx={ctx} action="merge" />
    ) : null,
}
