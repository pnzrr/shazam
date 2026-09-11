/**
 * DTOs shared by the server and the web client. Everything the UI renders is
 * normalized into these shapes so a column's data source can be swapped
 * without the components knowing where the rows came from.
 */

export type CheckState = 'success' | 'failure' | 'pending' | 'none'

export type ReviewDecision = 'approved' | 'changes_requested' | 'review_required' | 'none'

export type MergeableState = 'mergeable' | 'conflicting' | 'unknown'

export interface RepoRef {
  /** e.g. "phasetwo/keycloak-orgs" */
  nameWithOwner: string
  owner: string
  name: string
  url: string
}

export interface PullRequestItem {
  kind: 'pull_request'
  id: string
  number: number
  title: string
  url: string
  updatedAt: string
  createdAt: string
  isDraft: boolean
  author: string | null
  repo: RepoRef
  /** Repo the branch lives in - differs from `repo` for fork PRs. */
  headRepo: RepoRef | null
  headRef: string
  baseRef: string
  checks: CheckState
  reviewDecision: ReviewDecision
  mergeable: MergeableState
  /** Issue-level comments. */
  commentCount: number
  /** Unresolved inline review threads. */
  unresolvedThreadCount: number
  changedFiles: number
  additions: number
  deletions: number
  /** True when the viewer can merge it right now, per GitHub. */
  canMerge: boolean
  /**
   * Merge methods the base repository actually permits, in preference order.
   * Empty when the repo has disabled all of them.
   */
  allowedMergeMethods: MergeMethod[]
}

export interface IssueItem {
  kind: 'issue'
  id: string
  number: number
  title: string
  url: string
  updatedAt: string
  createdAt: string
  author: string | null
  repo: RepoRef
  commentCount: number
  labels: { name: string; color: string }[]
}

export type DashboardItem = PullRequestItem | IssueItem

export interface RateLimit {
  remaining: number
  limit: number
  resetAt: string
}

/** One poll's worth of data. Keyed by column id. */
export interface DashboardData {
  viewer: string
  fetchedAt: string
  /** Set when the most recent poll failed; the payload is the last good one. */
  error: string | null
  rateLimit: RateLimit | null
  columns: {
    myPullRequests: PullRequestItem[]
    reviewRequests: PullRequestItem[]
    myIssues: IssueItem[]
    assignedIssues: IssueItem[]
  }
}

export type ColumnId = keyof DashboardData['columns']

// ---------------------------------------------------------------------------
// Preflight / health
// ---------------------------------------------------------------------------

export type ToolStatus = 'ok' | 'missing' | 'error'

export interface ToolCheck {
  name: string
  /** A failed required tool stops the server from starting. */
  required: boolean
  status: ToolStatus
  version: string | null
  detail: string | null
}

export interface HealthReport {
  ok: boolean
  viewer: string | null
  tools: ToolCheck[]
  /** Agents that actually launched their preflight check, for the shazam menu. */
  agents: { id: AgentId; label: string; available: boolean }[]
  pollIntervalMs: number
  terminalFontSize: number
  defaultMergeMethod: MergeMethod
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type MergeMethod = 'squash' | 'merge' | 'rebase'

export interface ActionResult {
  ok: boolean
  message: string
}

// ---------------------------------------------------------------------------
// Agent sessions
// ---------------------------------------------------------------------------

export type AgentId = 'claude' | 'codex'

export type SessionStatus = 'preparing' | 'running' | 'exited' | 'failed'

export interface AgentSession {
  id: string
  agent: AgentId
  status: SessionStatus
  title: string
  prUrl: string
  repo: string
  prNumber: number
  branch: string
  worktreePath: string | null
  startedAt: string
  exitCode: number | null
  /** Populated while status is 'preparing' or on 'failed'. */
  note: string | null
}

// ---------------------------------------------------------------------------
// PTY websocket protocol
// ---------------------------------------------------------------------------

export type PtyClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }

export type PtyServerMessage =
  | { type: 'output'; data: string }
  | { type: 'status'; session: AgentSession }
  | { type: 'error'; message: string }
