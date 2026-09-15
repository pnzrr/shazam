import { GraphqlResponseError } from '@octokit/graphql'
import type {
  Reviewer,
  ReviewerCandidate,
  ReviewerState,
  ReviewersPanel,
} from '../../shared/types.js'
import { getGraphqlClient } from './client.js'

/**
 * Read on demand, from the Request button, for one pull request at a time.
 * Per-person review state is far more than the dashboard's own columns need,
 * and the dashboard query is already the expensive one.
 */
const REVIEWERS_QUERY = /* GraphQL */ `
  query Reviewers($owner: String!, $name: String!, $number: Int!, $q: String) {
    repository(owner: $owner, name: $name) {
      collaborators(first: 100, query: $q) {
        totalCount
        nodes {
          login
          name
          avatarUrl
        }
      }
      pullRequest(number: $number) {
        author {
          login
        }
        reviewRequests(first: 50) {
          nodes {
            requestedReviewer {
              __typename
              ... on User {
                login
                name
                avatarUrl
              }
              ... on Team {
                slug
                name
                avatarUrl
                organization {
                  login
                }
              }
            }
          }
        }
        latestReviews(first: 50) {
          nodes {
            state
            author {
              login
              avatarUrl
            }
          }
        }
      }
    }
  }
`

interface RawUser {
  __typename?: string
  login: string
  name: string | null
  avatarUrl: string
}

interface RawTeam {
  __typename?: string
  slug: string
  name: string | null
  avatarUrl: string | null
  organization: { login: string } | null
}

interface RawResponse {
  repository: {
    collaborators: { totalCount: number; nodes: (RawUser | null)[] } | null
    pullRequest: {
      author: { login: string } | null
      reviewRequests: { nodes: ({ requestedReviewer: RawUser | RawTeam | null } | null)[] }
      latestReviews: {
        nodes: ({ state: string; author: { login: string; avatarUrl: string } | null } | null)[]
      }
    } | null
  } | null
}

const present = <T>(nodes: (T | null)[] | undefined): T[] =>
  (nodes ?? []).filter((n): n is T => n != null)

function reviewerState(raw: string): ReviewerState | null {
  switch (raw) {
    case 'APPROVED':
      return 'approved'
    case 'CHANGES_REQUESTED':
      return 'changes_requested'
    case 'COMMENTED':
      return 'commented'
    case 'DISMISSED':
      return 'dismissed'
    default:
      // PENDING is a review the author has not submitted, which is theirs alone
      // to see; it is not a state anyone is waiting on.
      return null
  }
}

const isTeam = (raw: RawUser | RawTeam): raw is RawTeam => raw.__typename === 'Team'

export async function fetchReviewers(
  repo: string,
  number: number,
  q?: string,
): Promise<ReviewersPanel> {
  const [owner, name] = repo.split('/')
  if (!owner || !name) throw new Error(`Not an owner/name repository: ${repo}`)

  const client = await getGraphqlClient()

  let data: RawResponse
  try {
    data = await client<RawResponse>(REVIEWERS_QUERY, {
      owner,
      name,
      number,
      q: q?.trim() || null,
    })
  } catch (err) {
    // Listing collaborators needs push access, and it errors that one field
    // rather than the request. The review state is the half we cannot do
    // without, so keep whatever came back.
    if (err instanceof GraphqlResponseError && err.data) data = err.data as RawResponse
    else throw err
  }

  const pr = data.repository?.pullRequest
  if (!pr) throw new Error(`${repo}#${number} not found`)

  // Someone who reviewed and was then asked again is pending, not approved, so
  // the requests go on last and win.
  const byLogin = new Map<string, Reviewer>()

  for (const node of present(pr.latestReviews?.nodes)) {
    const state = node.author ? reviewerState(node.state) : null
    if (!node.author || !state) continue
    byLogin.set(node.author.login, {
      login: node.author.login,
      name: null,
      avatarUrl: node.author.avatarUrl,
      isTeam: false,
      state,
    })
  }

  for (const node of present(pr.reviewRequests?.nodes)) {
    const raw = node.requestedReviewer
    if (!raw) continue
    const reviewer: Reviewer = isTeam(raw)
      ? {
          login: `${raw.organization?.login ?? owner}/${raw.slug}`,
          name: raw.name,
          avatarUrl: raw.avatarUrl,
          isTeam: true,
          state: 'pending',
        }
      : {
          login: raw.login,
          name: raw.name,
          avatarUrl: raw.avatarUrl,
          isTeam: false,
          state: 'pending',
        }
    byLogin.set(reviewer.login, reviewer)
  }

  const reviewers = [...byLogin.values()].sort((a, b) => a.login.localeCompare(b.login))

  const collaborators = data.repository?.collaborators
  const candidates: ReviewerCandidate[] = present(collaborators?.nodes)
    // You cannot review your own pull request, and anyone already on it
    // belongs in the list above rather than among the people you could add.
    .filter((user) => user.login !== pr.author?.login && !byLogin.has(user.login))
    .map((user) => ({ login: user.login, name: user.name, avatarUrl: user.avatarUrl }))

  return {
    reviewers,
    candidates,
    truncated: (collaborators?.totalCount ?? 0) > present(collaborators?.nodes).length,
    note: collaborators
      ? null
      : 'Cannot list this repository’s collaborators - you need push access to request reviews.',
  }
}
