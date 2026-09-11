import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { HealthReport } from '../../shared/types.js'
import { approvePullRequest } from '../actions/approve.js'
import { closeIssue } from '../actions/close.js'
import { mergePullRequest } from '../actions/merge.js'
import type { SessionManager } from '../agent/sessions.js'
import type { DashboardPoller } from '../github/poller.js'

const repoRefSchema = z.object({ nameWithOwner: z.string().min(1), url: z.string().url() })

const shazamSchema = z.object({
  agent: z.enum(['claude', 'codex']),
  pr: z.object({
    url: z.string().url(),
    number: z.number().int().positive(),
    headRef: z.string().min(1),
    repo: z.object({ nameWithOwner: z.string().min(1) }),
    headRepo: repoRefSchema.nullable().default(null),
  }),
})

const mergeSchema = z.object({
  url: z.string().url(),
  method: z.enum(['squash', 'merge', 'rebase']),
  body: z.string().max(4000).optional(),
})

const approveSchema = z.object({
  url: z.string().url(),
  body: z.string().max(4000).optional(),
})

const closeIssueSchema = z.object({
  url: z.string().url(),
  comment: z.string().max(4000).optional(),
})

export interface ApiDeps {
  poller: DashboardPoller
  sessions: SessionManager
  health: HealthReport
}

export function registerApiRoutes(app: FastifyInstance, deps: ApiDeps): void {
  const { poller, sessions, health } = deps

  app.get('/api/health', async () => health)

  app.get('/api/dashboard', async () => {
    await poller.ready()
    return poller.snapshot
  })

  app.post('/api/dashboard/refresh', async () => poller.refresh())

  app.post('/api/pr/merge', async (request, reply) => {
    const parsed = mergeSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ ok: false, message: 'Invalid request' })

    const result = await mergePullRequest(parsed.data.url, parsed.data.method, parsed.data.body)
    // A merge changes several rows at once; refresh rather than wait for the poll.
    if (result.ok) void poller.refresh()
    return result
  })

  app.post('/api/pr/approve', async (request, reply) => {
    const parsed = approveSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ ok: false, message: 'Invalid request' })

    const result = await approvePullRequest(parsed.data.url, parsed.data.body)
    if (result.ok) void poller.refresh()
    return result
  })

  app.post('/api/issue/close', async (request, reply) => {
    const parsed = closeIssueSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ ok: false, message: 'Invalid request' })

    const result = await closeIssue(parsed.data.url, parsed.data.comment)
    if (result.ok) void poller.refresh()
    return result
  })

  app.get('/api/sessions', async () => sessions.list())

  app.post('/api/sessions', async (request, reply) => {
    const parsed = shazamSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid request' })
    }

    const agent = health.agents.find((a) => a.id === parsed.data.agent)
    if (!agent?.available) {
      return reply
        .code(409)
        .send({ ok: false, message: `${parsed.data.agent} is not installed or not on PATH` })
    }

    return sessions.create(parsed.data)
  })

  app.delete<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    const closed = sessions.close(request.params.id)
    if (!closed) return reply.code(404).send({ ok: false, message: 'No such session' })
    return { ok: true, message: 'Session closed' }
  })
}
