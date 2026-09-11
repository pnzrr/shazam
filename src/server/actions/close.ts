import type { ActionResult } from '../../shared/types.js'
import { runGh } from './gh.js'

export function closeIssue(url: string, comment?: string): Promise<ActionResult> {
  const args = ['issue', 'close', url]
  if (comment?.trim()) args.push('--comment', comment.trim())
  return runGh(args)
}
