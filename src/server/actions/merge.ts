import type { ActionResult, MergeMethod } from '../../shared/types.js'
import { runGh } from './gh.js'

const FLAGS: Record<MergeMethod, string> = {
  squash: '--squash',
  merge: '--merge',
  rebase: '--rebase',
}

export function mergePullRequest(
  url: string,
  method: MergeMethod,
  body?: string,
): Promise<ActionResult> {
  // The explicit method flag matters: without one gh opens an interactive
  // prompt, which would hang forever behind an HTTP request.
  const args = ['pr', 'merge', url, FLAGS[method]]
  if (body?.trim()) args.push('--body', body.trim())
  return runGh(args)
}
