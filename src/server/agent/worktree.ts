import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { execa } from 'execa'
import { loadConfig } from '../config.js'

export interface WorktreeRequest {
  /** Base repository, e.g. "octocat/hello-world". */
  repo: string
  prNumber: number
  headRef: string
  /** Head repository when the PR comes from a fork, else null. */
  headRepo: { nameWithOwner: string; url: string } | null
}

export interface WorktreeResult {
  path: string
  branch: string
  /**
   * The bare mirror backing this worktree. It is also git's canonical root for
   * the worktree, which is the key agents use for workspace trust.
   */
  gitRoot: string
  /** True when an earlier shazam already made this worktree. */
  reused: boolean
}

const git = (cwd: string, args: string[]) =>
  execa('git', args, { cwd, timeout: 300_000 })

/** Keep generated paths and refs free of anything that needs quoting. */
const slug = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')

function mirrorPath(repo: string): string {
  const [owner = 'unknown', name = 'unknown'] = repo.split('/')
  return join(loadConfig().mirrorsDir, slug(owner), `${slug(name)}.git`)
}

function worktreePath(repo: string, prNumber: number): string {
  const [owner = 'unknown', name = 'unknown'] = repo.split('/')
  return join(loadConfig().worktreesDir, `${slug(owner)}-${slug(name)}-pr${prNumber}`)
}

/**
 * Bare clone + an explicit branches-only refspec. We deliberately avoid
 * `--mirror`: its `+refs/*:refs/*` refspec combined with --prune would delete
 * the local branches our worktrees are sitting on every time we updated.
 */
async function ensureMirror(repo: string, onLog: (line: string) => void): Promise<string> {
  const path = mirrorPath(repo)

  if (!existsSync(join(path, 'HEAD'))) {
    onLog(`Cloning ${repo} (bare) into ${path}`)
    await mkdir(dirname(path), { recursive: true })
    await execa('gh', ['repo', 'clone', repo, path, '--', '--bare'], { timeout: 600_000 })
  }

  // Branches only. A `+refs/pull/*/head:...` refspec here looks tempting but is
  // a trap: on a heavily forked repo it drags in every fork's objects (41k refs
  // and 1.3GB on octocat/Spoon-Knife). PR heads are fetched one at a time below.
  await git(path, ['config', '--unset-all', 'remote.origin.fetch']).catch(() => {})
  await git(path, ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'])
  // `git push` from a worktree should target the PR branch, not a same-named one.
  await git(path, ['config', 'push.default', 'upstream'])

  onLog(`Fetching ${repo}`)
  await git(path, ['fetch', 'origin', '--prune', '--quiet'])

  return path
}

/**
 * Fetch exactly one PR head. `refs/pull/<n>/head` is served by GitHub for fork
 * and same-repo PRs alike, so this is the one code path for both.
 */
async function fetchPrHead(
  mirror: string,
  prNumber: number,
  onLog: (line: string) => void,
): Promise<string> {
  const ref = `refs/remotes/origin/pr/${prNumber}`
  onLog(`Fetching PR #${prNumber}`)
  await git(mirror, [
    'fetch',
    'origin',
    '--quiet',
    `+refs/pull/${prNumber}/head:${ref}`,
  ])
  return ref
}

export async function ensureWorktree(
  req: WorktreeRequest,
  onLog: (line: string) => void = () => {},
): Promise<WorktreeResult> {
  const mirror = await ensureMirror(req.repo, onLog)
  const path = worktreePath(req.repo, req.prNumber)
  const isFork = req.headRepo != null && req.headRepo.nameWithOwner !== req.repo
  // A fork's branch name can collide with one in the base repo, so namespace it.
  const branch = isFork ? `pr-${req.prNumber}-${slug(req.headRef)}` : req.headRef

  // Clear out records of worktrees whose directories the user has deleted.
  await git(mirror, ['worktree', 'prune']).catch(() => {})

  if (existsSync(join(path, '.git'))) {
    onLog(`Reusing worktree at ${path}`)
    return { path, branch, gitRoot: mirror, reused: true }
  }

  const prRef = await fetchPrHead(mirror, req.prNumber, onLog)

  onLog(`Creating worktree at ${path} on ${branch}`)
  await mkdir(dirname(path), { recursive: true })
  await git(mirror, ['worktree', 'add', '-B', branch, path, prRef])

  await configurePush(mirror, path, branch, req, isFork, onLog)

  return { path, branch, gitRoot: mirror, reused: false }
}

/** Wire up tracking so a plain `git push` in the worktree updates the PR. */
async function configurePush(
  mirror: string,
  path: string,
  branch: string,
  req: WorktreeRequest,
  isFork: boolean,
  onLog: (line: string) => void,
): Promise<void> {
  let remote = 'origin'

  if (isFork && req.headRepo) {
    remote = 'pr-head'
    const url = req.headRepo.url.endsWith('.git')
      ? req.headRepo.url
      : `${req.headRepo.url}.git`
    await git(mirror, ['remote', 'remove', remote]).catch(() => {})
    await git(mirror, ['remote', 'add', remote, url])
    onLog(`PR is from fork ${req.headRepo.nameWithOwner}; pushes will target it`)
  }

  await git(path, ['config', `branch.${branch}.remote`, remote])
  await git(path, ['config', `branch.${branch}.merge`, `refs/heads/${req.headRef}`])
}
