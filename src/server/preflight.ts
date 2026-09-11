import { execa } from 'execa'
import type { AgentId, HealthReport, MergeMethod, ToolCheck } from '../shared/types.js'
import { AGENT_LABELS } from './config.js'

interface ToolSpec {
  name: string
  required: boolean
  args: string[]
  /** Pull a human-readable version out of the command's stdout. */
  parse?: (stdout: string) => string
}

const firstLine = (s: string) => s.trim().split('\n')[0]?.trim() ?? ''

const TOOLS: ToolSpec[] = [
  { name: 'git', required: true, args: ['--version'] },
  { name: 'gh', required: true, args: ['--version'] },
  { name: 'claude', required: false, args: ['--version'] },
  { name: 'codex', required: false, args: ['--version'] },
]

async function checkTool(spec: ToolSpec): Promise<ToolCheck> {
  try {
    const { stdout } = await execa(spec.name, spec.args, { timeout: 15_000 })
    return {
      name: spec.name,
      required: spec.required,
      status: 'ok',
      version: (spec.parse ?? firstLine)(stdout),
      detail: null,
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { shortMessage?: string }
    const missing = e.code === 'ENOENT'
    return {
      name: spec.name,
      required: spec.required,
      status: missing ? 'missing' : 'error',
      version: null,
      detail: missing ? 'not found on PATH' : (e.shortMessage ?? e.message),
    }
  }
}

/** `gh auth status` doubles as the auth check and the source of the login name. */
async function checkGhAuth(): Promise<{ check: ToolCheck; viewer: string | null }> {
  try {
    const { stdout, stderr } = await execa('gh', ['auth', 'status'], { timeout: 20_000 })
    const text = `${stdout}\n${stderr}`
    const viewer = /account (\S+)/.exec(text)?.[1] ?? null
    const scopes = /Token scopes:\s*(.+)/.exec(text)?.[1]?.trim() ?? null
    const hasRepo = scopes?.includes("'repo'") ?? false
    return {
      check: {
        name: 'gh auth',
        required: true,
        status: 'ok',
        version: viewer ? `${viewer}` : 'authenticated',
        detail: hasRepo
          ? scopes
          : `${scopes ?? 'unknown scopes'} - missing 'repo', private repos and merges will fail`,
      },
      viewer,
    }
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { shortMessage?: string }
    return {
      check: {
        name: 'gh auth',
        required: true,
        status: e.code === 'ENOENT' ? 'missing' : 'error',
        version: null,
        detail: 'not logged in - run `gh auth login`',
      },
      viewer: null,
    }
  }
}

export interface PreflightResult extends HealthReport {
  /** Required tools that failed; non-empty means we should not start. */
  blockers: ToolCheck[]
}

export async function runPreflight(
  pollIntervalMs: number,
  terminalFontSize: number,
  defaultMergeMethod: MergeMethod,
): Promise<PreflightResult> {
  const [tools, auth] = await Promise.all([
    Promise.all(TOOLS.map(checkTool)),
    checkGhAuth(),
  ])

  // Slot the auth result in right after `gh` so the printed table reads in order.
  const ghIndex = tools.findIndex((t) => t.name === 'gh')
  const all = [...tools]
  all.splice(ghIndex + 1, 0, auth.check)

  const agentIds: AgentId[] = ['claude', 'codex']
  const agents = agentIds.map((id) => ({
    id,
    label: AGENT_LABELS[id],
    available: all.find((t) => t.name === id)?.status === 'ok',
  }))

  const blockers = all.filter((t) => t.required && t.status !== 'ok')

  return {
    ok: blockers.length === 0,
    viewer: auth.viewer,
    tools: all,
    agents,
    blockers,
    pollIntervalMs,
    terminalFontSize,
    defaultMergeMethod,
  }
}

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

export function printPreflight(result: PreflightResult): void {
  const width = Math.max(...result.tools.map((t) => t.name.length))
  console.log('')
  for (const tool of result.tools) {
    const ok = tool.status === 'ok'
    const color = ok ? GREEN : tool.required ? RED : YELLOW
    const mark = ok ? '✓' : tool.required ? '✗' : '!'
    const value = tool.version ?? tool.detail ?? tool.status
    const trailing = ok && tool.detail ? ` ${DIM}${tool.detail}${RESET}` : ''
    console.log(
      `  ${color}${mark}${RESET} ${tool.name.padEnd(width)}  ${value}${trailing}`,
    )
  }
  console.log('')

  for (const agent of result.agents) {
    if (!agent.available) {
      console.log(
        `  ${YELLOW}!${RESET} ${AGENT_LABELS[agent.id]} is unavailable - shazam will not offer it`,
      )
    }
  }
}
