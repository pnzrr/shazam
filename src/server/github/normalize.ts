import type {
  CheckState,
  IssueItem,
  MergeMethod,
  MergeableState,
  PullRequestItem,
  RepoRef,
  ReviewDecision,
} from '../../shared/types.js'

interface RawRepo {
  nameWithOwner: string
  name: string
  url: string
  owner: { login: string }
}

/** The base repo of a PR also tells us which merge buttons it has enabled. */
interface RawBaseRepo extends RawRepo {
  squashMergeAllowed: boolean
  mergeCommitAllowed: boolean
  rebaseMergeAllowed: boolean
}

export interface RawPr {
  id: string
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  updatedAt: string
  createdAt: string
  isDraft: boolean
  author: { login: string } | null
  repository: RawBaseRepo
  headRepository: RawRepo | null
  headRefName: string
  baseRefName: string
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  changedFiles: number
  additions: number
  deletions: number
  comments: { totalCount: number }
  reviewThreads: { nodes: ({ isResolved: boolean } | null)[] }
  commits: { nodes: ({ commit: { statusCheckRollup: { state: string } | null } } | null)[] }
}

export interface RawIssue {
  id: string
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED'
  updatedAt: string
  createdAt: string
  author: { login: string } | null
  repository: RawRepo
  comments: { totalCount: number }
  labels: { nodes: ({ name: string; color: string } | null)[] }
}

function repoRef(raw: RawRepo): RepoRef {
  return {
    nameWithOwner: raw.nameWithOwner,
    owner: raw.owner.login,
    name: raw.name,
    url: raw.url,
  }
}

/** Preference order for picking a fallback when the configured method is off. */
function allowedMergeMethods(raw: RawBaseRepo): MergeMethod[] {
  const methods: MergeMethod[] = []
  if (raw.squashMergeAllowed) methods.push('squash')
  if (raw.mergeCommitAllowed) methods.push('merge')
  if (raw.rebaseMergeAllowed) methods.push('rebase')
  return methods
}

function checkState(raw: RawPr): CheckState {
  const state = raw.commits.nodes[0]?.commit.statusCheckRollup?.state
  switch (state) {
    case 'SUCCESS':
      return 'success'
    case 'FAILURE':
    case 'ERROR':
      return 'failure'
    case 'PENDING':
    case 'EXPECTED':
      return 'pending'
    default:
      return 'none'
  }
}

function reviewDecision(raw: RawPr): ReviewDecision {
  switch (raw.reviewDecision) {
    case 'APPROVED':
      return 'approved'
    case 'CHANGES_REQUESTED':
      return 'changes_requested'
    case 'REVIEW_REQUIRED':
      return 'review_required'
    default:
      return 'none'
  }
}

function mergeable(raw: RawPr): MergeableState {
  switch (raw.mergeable) {
    case 'MERGEABLE':
      return 'mergeable'
    case 'CONFLICTING':
      return 'conflicting'
    default:
      return 'unknown'
  }
}

export function normalizePr(raw: RawPr): PullRequestItem {
  const checks = checkState(raw)
  const decision = reviewDecision(raw)
  const merge = mergeable(raw)

  return {
    kind: 'pull_request',
    id: raw.id,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    updatedAt: raw.updatedAt,
    createdAt: raw.createdAt,
    isDraft: raw.isDraft,
    author: raw.author?.login ?? null,
    repo: repoRef(raw.repository),
    headRepo: raw.headRepository ? repoRef(raw.headRepository) : null,
    headRef: raw.headRefName,
    baseRef: raw.baseRefName,
    checks,
    reviewDecision: decision,
    mergeable: merge,
    commentCount: raw.comments.totalCount,
    unresolvedThreadCount: raw.reviewThreads.nodes.filter((n) => n && !n.isResolved).length,
    changedFiles: raw.changedFiles,
    additions: raw.additions,
    deletions: raw.deletions,
    // GitHub has no single "viewer can merge" field without preview headers, so
    // we approximate it: approved, no conflicts, CI not red, not a draft.
    canMerge:
      !raw.isDraft &&
      decision === 'approved' &&
      merge === 'mergeable' &&
      checks !== 'failure' &&
      checks !== 'pending',
    allowedMergeMethods: allowedMergeMethods(raw.repository),
  }
}

export function normalizeIssue(raw: RawIssue): IssueItem {
  return {
    kind: 'issue',
    id: raw.id,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    updatedAt: raw.updatedAt,
    createdAt: raw.createdAt,
    author: raw.author?.login ?? null,
    repo: repoRef(raw.repository),
    commentCount: raw.comments.totalCount,
    labels: raw.labels.nodes.filter((l): l is { name: string; color: string } => l !== null),
  }
}
