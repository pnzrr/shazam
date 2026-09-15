import type { ActionResult } from '../../shared/types.js'
import { runGh } from './gh.js'

/**
 * Adding someone who has already reviewed re-requests them, which is what the
 * button does for an approved or stale reviewer - the same as GitHub's own
 * circular-arrow next to a name.
 */
export function editReviewers(
  url: string,
  add: string[],
  remove: string[],
): Promise<ActionResult> {
  const args = ['pr', 'edit', url]
  if (add.length > 0) args.push('--add-reviewer', add.join(','))
  if (remove.length > 0) args.push('--remove-reviewer', remove.join(','))
  return runGh(args)
}
