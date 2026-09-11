import { IssueCard } from '../IssueCard.js'
import type { ColumnDef } from '../registry.js'

export const myIssues: ColumnDef = {
  id: 'myIssues',
  title: 'Issues I opened',
  hint: 'Open issues you opened, most recently updated first',
  empty: 'No open issues of yours.',
  select: (data) => data.columns.myIssues,
  renderItem: (item, ctx) =>
    item.kind === 'issue' ? <IssueCard key={item.id} issue={item} ctx={ctx} /> : null,
}
