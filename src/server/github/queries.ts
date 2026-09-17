/**
 * One request per poll. Five aliased searches plus rateLimit means the whole
 * dashboard costs a single round trip no matter how many columns are on screen.
 */
export const DASHBOARD_QUERY = /* GraphQL */ `
  fragment RepoFields on Repository {
    nameWithOwner
    name
    url
    owner {
      login
    }
  }

  fragment PrFields on PullRequest {
    id
    number
    title
    url
    state
    updatedAt
    createdAt
    isDraft
    author {
      login
    }
    repository {
      ...RepoFields
      squashMergeAllowed
      mergeCommitAllowed
      rebaseMergeAllowed
      viewerPermission
    }
    headRepository {
      ...RepoFields
    }
    headRefName
    baseRefName
    mergeable
    reviewDecision
    changedFiles
    additions
    deletions
    comments {
      totalCount
    }
    reviewRequests(first: 0) {
      totalCount
    }
    reviewThreads(first: 50) {
      nodes {
        isResolved
      }
    }
    commits(last: 1) {
      nodes {
        commit {
          statusCheckRollup {
            state
          }
        }
      }
    }
  }

  fragment IssueFields on Issue {
    id
    number
    title
    url
    state
    updatedAt
    createdAt
    author {
      login
    }
    repository {
      ...RepoFields
    }
    comments {
      totalCount
    }
    labels(first: 10) {
      nodes {
        name
        color
      }
    }
  }

  query Dashboard(
    $myPullRequests: String!
    $reviewRequests: String!
    $approvedPrs: String!
    $myIssues: String!
    $myIssuesAssigned: String!
    $limit: Int!
  ) {
    viewer {
      login
    }
    myPullRequests: search(query: $myPullRequests, type: ISSUE, first: $limit) {
      nodes {
        ...PrFields
      }
    }
    reviewRequests: search(query: $reviewRequests, type: ISSUE, first: $limit) {
      nodes {
        ...PrFields
      }
    }
    approvedPrs: search(query: $approvedPrs, type: ISSUE, first: $limit) {
      nodes {
        ...PrFields
        # Only this search pays for the review nodes: search can say "the
        # viewer reviewed it" but not "the viewer's review was an approval",
        # so the poller reads the viewer's standing verdict off each row and
        # keeps the approved ones.
        ... on PullRequest {
          latestOpinionatedReviews(first: 10) {
            nodes {
              state
              author {
                login
              }
            }
          }
        }
      }
    }
    myIssues: search(query: $myIssues, type: ISSUE, first: $limit) {
      nodes {
        ...IssueFields
      }
    }
    myIssuesAssigned: search(query: $myIssuesAssigned, type: ISSUE, first: $limit) {
      nodes {
        ...IssueFields
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`

export const SEARCH_QUERIES = {
  myPullRequests: 'is:open is:pr author:@me archived:false sort:updated-desc',
  /**
   * `-reviewed-by:@me` is what makes this "outstanding": GitHub keeps a review
   * request listed after you submit a review, and we only want untouched ones.
   */
  reviewRequests:
    'is:open is:pr review-requested:@me -author:@me -reviewed-by:@me archived:false sort:updated-desc',
  /**
   * `-review-requested:@me` keeps a PR whose review was re-requested after
   * your approval in "Waiting on my review" instead of both columns. Search
   * cannot narrow `reviewed-by:@me` to approvals (`review:approved` is the
   * PR's overall decision, not yours), so the poller filters these rows by the
   * viewer's own latest opinionated review.
   */
  approvedPrs:
    'is:open is:pr reviewed-by:@me -author:@me -review-requested:@me archived:false sort:updated-desc',
  myIssues: 'is:open is:issue author:@me archived:false sort:updated-desc',
  /**
   * `-author:@me` keeps the two issue columns disjoint, the same way
   * reviewRequests excludes your own PRs - assigning yourself to an issue you
   * opened should not list it twice across the dashboard.
   */
  myIssuesAssigned:
    'is:open is:issue assignee:@me -author:@me archived:false sort:updated-desc',
} as const
