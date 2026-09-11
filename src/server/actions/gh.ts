import { execa } from 'execa'
import type { ActionResult } from '../../shared/types.js'

/**
 * Mutations go through the `gh` CLI rather than the GraphQL token so they run
 * as exactly the identity the developer sees in `gh auth status`, and so we
 * inherit gh's handling of merge queues, protected branches and the like.
 */
export async function runGh(args: string[]): Promise<ActionResult> {
  try {
    const { stdout, stderr } = await execa('gh', args, { timeout: 120_000 })
    const message = [stdout, stderr].map((s) => s.trim()).filter(Boolean).join('\n')
    return { ok: true, message: message || 'Done.' }
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; shortMessage?: string; message: string }
    const message = [e.stderr, e.stdout]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join('\n')
    return { ok: false, message: message || e.shortMessage || e.message }
  }
}
