import { GraphqlResponseError } from '@octokit/graphql'
import type { DashboardData, PullRequestItem } from '../../shared/types.js'
import { branchMergeMethods } from './branchRules.js'
import { getGraphqlClient, resetClient } from './client.js'
import { normalizeIssue, normalizePr, type RawIssue, type RawPr } from './normalize.js'
import { DASHBOARD_QUERY, SEARCH_QUERIES } from './queries.js'

interface RawResponse {
  viewer: { login: string }
  myPullRequests: { nodes: (RawPr | null)[] }
  reviewRequests: { nodes: (RawPr | null)[] }
  myIssues: { nodes: (RawIssue | null)[] }
  myIssuesAssigned: { nodes: (RawIssue | null)[] }
  rateLimit: { limit: number; remaining: number; resetAt: string } | null
}

/** Search can return empty objects for items the token cannot fully read. */
const present = <T extends { id?: string }>(nodes: (T | null)[]): T[] =>
  nodes.filter((n): n is T => n != null && n.id != null)

/**
 * `is:open` in the search string is not enough. GitHub's search index is
 * eventually consistent, so something you just closed or merged keeps matching
 * for a while, and comes back with fresh field values - which shows up as a row
 * that updates but never leaves the list. The item's own state is authoritative.
 */
export const isOpen = <T extends { state?: string }>(node: T): boolean =>
  node.state === undefined || node.state === 'OPEN'

const byUpdatedDesc = <T extends { updatedAt: string }>(a: T, b: T) =>
  b.updatedAt.localeCompare(a.updatedAt)


/**
 * Narrow each PR's merge methods by any ruleset on its base branch. Only asked
 * for PRs whose Merge button is actually live, so the extra REST calls stay in
 * single digits and are then served from cache.
 */
export async function applyBranchRules(prs: PullRequestItem[]): Promise<void> {
  // Mirrors the Merge button's own enabled condition, so every PR you can
  // actually click has had its methods narrowed - including one whose
  // mergeability GitHub is still computing.
  const eligible = prs.filter(
    (pr) =>
      !pr.isDraft &&
      pr.reviewDecision === 'approved' &&
      pr.mergeable !== 'conflicting' &&
      pr.checks !== 'failure' &&
      pr.allowedMergeMethods.length > 0,
  )

  await Promise.all(
    eligible.map(async (pr) => {
      const permitted = await branchMergeMethods(pr.repo.nameWithOwner, pr.baseRef)
      if (!permitted) return
      pr.allowedMergeMethods = pr.allowedMergeMethods.filter((m) => permitted.includes(m))
    }),
  )
}

export async function fetchDashboard(limit: number): Promise<DashboardData> {
  const client = await getGraphqlClient()

  let data: RawResponse
  try {
    data = await client<RawResponse>(DASHBOARD_QUERY, {
      myPullRequests: SEARCH_QUERIES.myPullRequests,
      reviewRequests: SEARCH_QUERIES.reviewRequests,
      myIssues: SEARCH_QUERIES.myIssues,
      myIssuesAssigned: SEARCH_QUERIES.myIssuesAssigned,
      limit,
    })
  } catch (err) {
    // Partial failures are common: one unreadable repo in a search result set
    // errors the field but GitHub still returns everything else.
    if (err instanceof GraphqlResponseError && err.data) {
      data = err.data as RawResponse
    } else {
      throw err
    }
  }

  const columns = {
    myPullRequests: present(data.myPullRequests?.nodes ?? [])
      .filter(isOpen)
      .map(normalizePr)
      .sort(byUpdatedDesc),
    reviewRequests: present(data.reviewRequests?.nodes ?? [])
      .filter(isOpen)
      .map(normalizePr)
      .sort(byUpdatedDesc),
    myIssues: present(data.myIssues?.nodes ?? [])
      .filter(isOpen)
      .map(normalizeIssue)
      .sort(byUpdatedDesc),
    assignedIssues: present(data.myIssuesAssigned?.nodes ?? [])
      .filter(isOpen)
      .map(normalizeIssue)
      .sort(byUpdatedDesc),
  }

  await applyBranchRules(columns.myPullRequests)

  return {
    viewer: data.viewer?.login ?? '',
    fetchedAt: new Date().toISOString(),
    error: null,
    rateLimit: data.rateLimit,
    columns,
  }
}

const EMPTY: DashboardData = {
  viewer: '',
  fetchedAt: new Date(0).toISOString(),
  error: null,
  rateLimit: null,
  columns: { myPullRequests: [], reviewRequests: [], myIssues: [], assignedIssues: [] },
}

/**
 * Polls GitHub on an interval into an in-memory cache. Clients read the cache,
 * so extra browser tabs and manual refreshes cost nothing against the API.
 */
export class DashboardPoller {
  private data: DashboardData = EMPTY
  private timer: NodeJS.Timeout | null = null
  private inFlight: Promise<DashboardData> | null = null
  private consecutiveFailures = 0
  private firstRun: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly intervalMs: number,
    private readonly limit: number,
  ) {}

  get snapshot(): DashboardData {
    return this.data
  }

  /**
   * Resolves once the first poll has landed, so a browser that connects during
   * startup gets real rows instead of an empty dashboard. Capped, because a
   * slow or unreachable GitHub must not hang the page load.
   */
  async ready(timeoutMs = 10_000): Promise<void> {
    await Promise.race([
      this.firstRun,
      new Promise((resolve) => setTimeout(resolve, timeoutMs).unref()),
    ])
  }

  start(): void {
    if (this.timer) return
    this.firstRun = this.refresh()
    this.timer = setInterval(() => void this.refresh(), this.intervalMs)
    this.timer.unref()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Coalesces concurrent callers onto one in-flight request. */
  async refresh(): Promise<DashboardData> {
    if (this.inFlight) return this.inFlight

    this.inFlight = this.run()
    try {
      return await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  private async run(): Promise<DashboardData> {
    try {
      this.data = await fetchDashboard(this.limit)
      this.consecutiveFailures = 0
    } catch (err) {
      this.consecutiveFailures += 1
      // A rotated or expired gh token is the likeliest cause; force a re-read.
      if (this.consecutiveFailures === 1) resetClient()
      const message = err instanceof Error ? err.message : String(err)
      console.error(`shazam: poll failed (${this.consecutiveFailures}x): ${message}`)
      // Keep serving the last good payload; the UI surfaces `error` as a banner.
      this.data = { ...this.data, error: message }
    }
    return this.data
  }
}
