import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import type { AgentId, MergeMethod } from '../shared/types.js'

export const SHAZAM_HOME = process.env.SHAZAM_HOME ?? join(homedir(), '.shazam')

const configSchema = z.object({
  /** Milliseconds between GitHub polls. Floor of 15s to stay friendly to the API. */
  pollIntervalMs: z.number().int().min(15_000).default(60_000),
  port: z.number().int().min(1).max(65535).default(4270),
  defaultAgent: z.enum(['claude', 'codex']).default('claude'),
  defaultMergeMethod: z.enum(['squash', 'merge', 'rebase']).default('squash'),
  /** Max rows fetched per column. 100 is GitHub's own page ceiling for search. */
  perColumnLimit: z.number().int().min(1).max(100).default(100),
  /**
   * Pre-accept the agent workspace-trust prompt for worktrees shazam created,
   * so the first Shazam in a repository does not stop on a dialog. Only ever
   * applies to paths under this config's own mirrors/worktrees directories.
   */
  trustWorktrees: z.boolean().default(true),
  /** Font size, in px, for the embedded agent terminal. */
  terminalFontSize: z.number().int().min(8).max(48).default(20),
  /**
   * `{url}`, `{path}`, `{branch}`, `{repo}` and `{number}` are substituted
   * before the prompt is handed to the agent.
   */
  shazamPrompt: z
    .string()
    .default(
      [
        'You are working on pull request {url}.',
        '',
        'Start by loading it: `gh pr view {url} --comments` and `gh pr diff {url}`.',
        '',
        'You are in a git worktree at {path}, checked out to branch `{branch}` of {repo}.',
        'This worktree is dedicated to PR #{number}; you can commit and push from here.',
        '',
        'Review the PR description, its CI status, and any review comments or requested',
        'changes. Then summarize what needs doing and wait for my instruction before',
        'making any changes.',
      ].join('\n'),
    ),
})

export type Config = z.infer<typeof configSchema> & {
  configPath: string
  mirrorsDir: string
  worktreesDir: string
}

export interface ConfigOverrides {
  port?: number
  pollIntervalMs?: number
}

let cached: Config | null = null

export function loadConfig(overrides: ConfigOverrides = {}): Config {
  if (cached) return cached

  const configPath = join(SHAZAM_HOME, 'config.json')
  let fromDisk: unknown = {}
  try {
    fromDisk = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (err) {
    // A missing config file is the normal case; anything else is worth saying.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`shazam: ignoring unreadable ${configPath}: ${(err as Error).message}`)
    }
  }

  const parsed = configSchema.parse(fromDisk)
  const defined = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v !== undefined),
  )

  cached = {
    ...parsed,
    ...defined,
    configPath,
    mirrorsDir: join(SHAZAM_HOME, 'mirrors'),
    worktreesDir: join(SHAZAM_HOME, 'worktrees'),
  }
  return cached
}

export const AGENT_LABELS: Record<AgentId, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
}

export const MERGE_METHOD_LABELS: Record<MergeMethod, string> = {
  squash: 'Squash and merge',
  merge: 'Create a merge commit',
  rebase: 'Rebase and merge',
}
