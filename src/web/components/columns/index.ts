import type { ColumnDef } from '../registry.js'
import { approvedPrs } from './approvedPrs.js'
import { assignedIssues } from './assignedIssues.js'
import { myIssues } from './myIssues.js'
import { myPullRequests } from './myPullRequests.js'
import { reviewRequests } from './reviewRequests.js'

/** Order here is the order on screen. */
export const COLUMNS: ColumnDef[] = [
  myPullRequests,
  reviewRequests,
  approvedPrs,
  myIssues,
  assignedIssues,
]
