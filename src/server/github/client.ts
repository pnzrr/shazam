import { execa } from 'execa'
import { graphql } from '@octokit/graphql'

export type GraphqlClient = typeof graphql

let cached: { token: string; client: GraphqlClient } | null = null

/**
 * We piggyback on the `gh` CLI's credentials rather than asking the user for a
 * token: the README assumes gh is installed and logged in, and this keeps
 * shazam from ever persisting a secret of its own.
 */
export async function getToken(): Promise<string> {
  const { stdout } = await execa('gh', ['auth', 'token'], { timeout: 15_000 })
  const token = stdout.trim()
  if (!token) throw new Error('`gh auth token` returned nothing - run `gh auth login`')
  return token
}

export async function getGraphqlClient(): Promise<GraphqlClient> {
  const token = await getToken()
  if (cached?.token === token) return cached.client

  const client = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
      'user-agent': 'shazam',
    },
  })
  cached = { token, client }
  return client
}

/** Drop the memoized client so the next call re-reads the token from gh. */
export function resetClient(): void {
  cached = null
}
