import { IssueCard } from '../IssueCard.js'
import type { ColumnDef } from '../registry.js'

export const assignedIssues: ColumnDef = {
  id: 'assignedIssues',
  title: 'Assigned to me',
  hint: 'Open issues assigned to you that someone else opened',
  empty: 'Nothing assigned to you.',
  select: (data) => data.columns.assignedIssues,
  renderItem: (item, ctx) =>
    item.kind === 'issue' ? <IssueCard key={item.id} issue={item} ctx={ctx} /> : null,
}
