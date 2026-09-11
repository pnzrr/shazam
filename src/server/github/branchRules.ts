import type { MergeMethod } from '../../shared/types.js'
import { getToken } from './client.js'

interface RuleEntry {
  type: string
  parameters?: { allowed_merge_methods?: string[] }
}

/** Rules change rarely; a poll every 60s must not re-ask for each of them. */
const TTL_MS = 10 * 60_000

const cache = new Map<string, { methods: MergeMethod[] | null; at: number }>()

const isMergeMethod = (value: string): value is MergeMethod =>
  value === 'merge' || value === 'squash' || value === 'rebase'

/**
 * Repository settings are only half the story: a ruleset on the base branch can
 * narrow the merge methods further, so a repo with squash enabled everywhere
 * can still refuse a squash into `main`. Returns the methods that branch
 * permits, or null when no rule constrains them (or we could not find out).
 */
export async function branchMergeMethods(
  repo: string,
  branch: string,
): Promise<MergeMethod[] | null> {
  const key = `${repo}#${branch}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.methods

  let methods: MergeMethod[] | null = null
  try {
    const token = await getToken()
    const response = await fetch(
      `https://api.github.com/repos/${repo}/rules/branches/${encodeURIComponent(branch)}`,
      {
        headers: {
          authorization: `token ${token}`,
          accept: 'application/vnd.github+json',
          'user-agent': 'shazam',
        },
      },
    )

    if (response.ok) {
      const rules = (await response.json()) as RuleEntry[]
      for (const rule of rules) {
        const allowed = rule.parameters?.allowed_merge_methods
        if (rule.type === 'pull_request' && Array.isArray(allowed)) {
          const parsed = allowed.map((m) => m.toLowerCase()).filter(isMergeMethod)
          // Several rulesets can apply at once; every one of them has to agree.
          methods = methods === null ? parsed : methods.filter((m) => parsed.includes(m))
        }
        // A linear history requirement rules out merge commits specifically.
        if (rule.type === 'required_linear_history') {
          const current: MergeMethod[] = methods ?? ['squash', 'merge', 'rebase']
          methods = current.filter((m) => m !== 'merge')
        }
      }
    }
  } catch {
    // Network trouble or no permission to read rules: fall back to repo settings.
    methods = null
  }

  cache.set(key, { methods, at: Date.now() })
  return methods
}
