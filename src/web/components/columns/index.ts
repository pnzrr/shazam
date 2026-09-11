import type { ColumnDef } from '../registry.js'
import { assignedIssues } from './assignedIssues.js'
import { myIssues } from './myIssues.js'
import { myPullRequests } from './myPullRequests.js'
import { reviewRequests } from './reviewRequests.js'

/** Order here is the order on screen. */
export const COLUMNS: ColumnDef[] = [myPullRequests, reviewRequests, myIssues, assignedIssues]
