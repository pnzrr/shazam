import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'

export type TrustOutcome = 'already-trusted' | 'granted' | 'skipped' | 'failed'

const CLAUDE_CONFIG = join(homedir(), '.claude.json')

/** Only ever grant trust for directories shazam itself created. */
function isOurs(target: string, root: string): boolean {
  return resolve(target).startsWith(resolve(root) + sep)
}

/**
 * Claude Code keys workspace trust on the canonical git root, which for our
 * worktrees is the bare mirror - so one grant covers every PR in that repo.
 * There is no CLI flag for it, and `--print` (which skips the dialog) is not
 * interactive, so we record the same grant the dialog would have written.
 *
 * `~/.claude.json` is rewritten wholesale by running Claude sessions, so this
 * re-reads immediately before writing and does nothing when the grant already
 * exists - which is the case for every launch after the first in a repo.
 */
export function trustClaudeWorkspace(gitRoot: string, mirrorsDir: string): TrustOutcome {
  if (!isOurs(gitRoot, mirrorsDir)) return 'skipped'

  try {
    const config = JSON.parse(readFileSync(CLAUDE_CONFIG, 'utf8')) as {
      projects?: Record<string, { hasTrustDialogAccepted?: boolean }>
    }

    if (config.projects?.[gitRoot]?.hasTrustDialogAccepted === true) return 'already-trusted'

    config.projects ??= {}
    config.projects[gitRoot] = {
      ...config.projects[gitRoot],
      hasTrustDialogAccepted: true,
    }

    // Write-and-rename so a crash mid-write cannot truncate Claude's config.
    const tmp = `${CLAUDE_CONFIG}.shazam-${process.pid}.tmp`
    writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
    renameSync(tmp, CLAUDE_CONFIG)
    return 'granted'
  } catch {
    // No config yet, unreadable, or not ours to write - fall back to the dialog.
    return 'failed'
  }
}

/**
 * Codex takes per-invocation config overrides, so its equivalent needs no file
 * writing at all.
 */
export function codexTrustArgs(cwd: string, worktreesDir: string): string[] {
  if (!isOurs(cwd, worktreesDir)) return []
  return ['-c', `projects."${cwd}".trust_level="trusted"`]
}
