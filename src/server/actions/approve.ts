import type { ActionResult } from '../../shared/types.js'
import { runGh } from './gh.js'

export function approvePullRequest(url: string, body?: string): Promise<ActionResult> {
  const args = ['pr', 'review', url, '--approve']
  if (body?.trim()) args.push('--body', body.trim())
  return runGh(args)
}
