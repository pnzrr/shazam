import { randomBytes } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SHAZAM_HOME } from './config.js'

/**
 * The dashboard can spawn interactive shells, so /api and /ws are gated by a
 * shared secret even on loopback. It is persisted (0600) rather than
 * regenerated per run so an already-open tab keeps working across restarts.
 */
export function loadOrCreateToken(): string {
  const path = join(SHAZAM_HOME, 'token')
  try {
    const existing = readFileSync(path, 'utf8').trim()
    if (existing.length >= 32) return existing
  } catch {
    // fall through and mint a new one
  }

  const token = randomBytes(32).toString('hex')
  mkdirSync(SHAZAM_HOME, { recursive: true })
  writeFileSync(path, `${token}\n`, { mode: 0o600 })
  chmodSync(path, 0o600)
  return token
}

/** Constant-time-ish comparison; the strings are fixed length hex. */
export function tokenMatches(expected: string, given: unknown): boolean {
  if (typeof given !== 'string' || given.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
  }
  return diff === 0
}

/**
 * A page on another origin cannot read our responses, but it can still drive
 * side effects if it guesses the token, so we pin Origin to loopback too.
 */
export function originAllowed(origin: string | undefined, port: number): boolean {
  if (!origin) return true // non-browser clients (curl, tests) send none
  try {
    const url = new URL(origin)
    const localHosts = ['127.0.0.1', 'localhost', '[::1]', '::1']
    if (!localHosts.includes(url.hostname)) return false
    // Vite's dev server proxies from its own port during development.
    return url.port === String(port) || url.port === '4271'
  } catch {
    return false
  }
}
