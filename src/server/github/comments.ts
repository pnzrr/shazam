import { GraphqlResponseError } from '@octokit/graphql'
import type { CommentItem, CommentThread, ReviewState } from '../../shared/types.js'
import { getGraphqlClient } from './client.js'

/**
 * Comments are read on demand - one click on a comment chip - rather than on
 * the poll, so the dashboard's single request per minute stays a single
 * request per minute no matter how chatty the repositories are.
 */
export const COMMENTS_QUERY = /* GraphQL */ `
  fragment Body on Comment {
    id
    bodyHTML
    createdAt
    author {
      login
      avatarUrl
    }
  }

  query Comments($owner: String!, $name: String!, $number: Int!, $limit: Int!) {
    repository(owner: $owner, name: $name) {
      issueOrPullRequest(number: $number) {
        __typename
        ... on Issue {
          comments(last: $limit) {
            totalCount
            nodes {
              ...Body
              url
            }
          }
        }
        ... on PullRequest {
          comments(last: $limit) {
            totalCount
            nodes {
              ...Body
              url
            }
          }
          reviews(last: $limit) {
            nodes {
              ...Body
              url
              state
            }
          }
          reviewThreads(last: 50) {
            nodes {
              isResolved
              path
              comments(first: 25) {
                nodes {
                  ...Body
                  url
                }
              }
            }
          }
        }
      }
    }
  }
`

interface RawAuthor {
  login: string
  avatarUrl: string
}

interface RawBody {
  id: string
  bodyHTML: string
  createdAt: string
  url: string
  author: RawAuthor | null
}

interface RawReview extends RawBody {
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
}

interface RawThread {
  isResolved: boolean
  path: string | null
  comments: { nodes: (RawBody | null)[] }
}

interface RawResponse {
  repository: {
    issueOrPullRequest: {
      __typename: 'Issue' | 'PullRequest'
      comments?: { totalCount: number; nodes: (RawBody | null)[] }
      reviews?: { nodes: (RawReview | null)[] }
      reviewThreads?: { nodes: (RawThread | null)[] }
    } | null
  } | null
}

const present = <T>(nodes: (T | null)[] | undefined): T[] =>
  (nodes ?? []).filter((n): n is T => n != null)

function reviewState(raw: RawReview['state']): ReviewState | null {
  switch (raw) {
    case 'APPROVED':
      return 'approved'
    case 'CHANGES_REQUESTED':
      return 'changes_requested'
    case 'DISMISSED':
      return 'dismissed'
    case 'COMMENTED':
      return 'commented'
    default:
      return null
  }
}

function base(raw: RawBody): Omit<CommentItem, 'kind' | 'reviewState' | 'path' | 'isResolved'> {
  return {
    id: raw.id,
    author: raw.author?.login ?? null,
    avatarUrl: raw.author?.avatarUrl ?? null,
    bodyHtml: raw.bodyHTML,
    createdAt: raw.createdAt,
    url: raw.url,
  }
}

/**
 * GitHub models an inline review comment as living inside a review, which in
 * turn has a body of its own. Flattening the three sources into one list
 * ordered by time is what actually reads like the conversation on the page.
 */
export async function fetchComments(repo: string, number: number): Promise<CommentThread> {
  const [owner, name] = repo.split('/')
  if (!owner || !name) throw new Error(`Not an owner/name repository: ${repo}`)

  const client = await getGraphqlClient()
  const limit = 50

  let data: RawResponse
  try {
    data = await client<RawResponse>(COMMENTS_QUERY, { owner, name, number, limit })
  } catch (err) {
    // Same as the dashboard poll: one unreadable field still returns the rest.
    if (err instanceof GraphqlResponseError && err.data) data = err.data as RawResponse
    else throw err
  }

  const node = data.repository?.issueOrPullRequest
  if (!node) throw new Error(`${repo}#${number} not found`)

  const comments: CommentItem[] = present(node.comments?.nodes).map((raw) => ({
    ...base(raw),
    kind: 'comment',
    reviewState: null,
    path: null,
    isResolved: null,
  }))

  for (const raw of present(node.reviews?.nodes)) {
    const state = reviewState(raw.state)
    // A COMMENTED review with no body of its own is just the envelope around
    // its inline comments, which come through reviewThreads below.
    if (!state || (state === 'commented' && raw.bodyHTML.trim() === '')) continue
    comments.push({ ...base(raw), kind: 'review', reviewState: state, path: null, isResolved: null })
  }

  for (const thread of present(node.reviewThreads?.nodes)) {
    for (const raw of present(thread.comments.nodes)) {
      comments.push({
        ...base(raw),
        kind: 'review_comment',
        reviewState: null,
        path: thread.path,
        isResolved: thread.isResolved,
      })
    }
  }

  comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const fetched = present(node.comments?.nodes).length
  return {
    url: `https://github.com/${repo}/${node.__typename === 'Issue' ? 'issues' : 'pull'}/${number}`,
    comments,
    truncated: (node.comments?.totalCount ?? 0) > fetched,
  }
}

/**
 * Opening the same chip twice in quick succession is the normal way to use
 * this, so hold each conversation briefly rather than paying GitHub for it
 * again. Short enough that a comment posted while you look lands on reopen.
 */
const TTL_MS = 30_000

const cache = new Map<string, { at: number; thread: Promise<CommentThread> }>()

export function getComments(repo: string, number: number): Promise<CommentThread> {
  const key = `${repo}#${number}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.thread

  // Cached as a promise, so two clicks in the same tick share one request.
  const thread = fetchComments(repo, number)
  cache.set(key, { at: Date.now(), thread })
  // A failure must not be what the next click gets served.
  thread.catch(() => cache.delete(key))
  return thread
}
