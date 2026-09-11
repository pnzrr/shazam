import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fastifyStatic from '@fastify/static'
import fastifyWebsocket from '@fastify/websocket'
import Fastify, { type FastifyInstance } from 'fastify'
import type { HealthReport } from '../shared/types.js'
import { originAllowed, tokenMatches } from './auth.js'
import { SessionManager } from './agent/sessions.js'
import type { Config } from './config.js'
import { DashboardPoller } from './github/poller.js'
import { registerApiRoutes } from './routes/api.js'
import { registerPtyRoute } from './routes/pty.js'

const here = dirname(fileURLToPath(import.meta.url))
/** dist/server/index.js -> dist/web */
const WEB_ROOT = join(here, '..', 'web')

export interface ServerHandle {
  app: FastifyInstance
  poller: DashboardPoller
  sessions: SessionManager
  url: string
  stop: () => Promise<void>
}

export async function startServer(
  config: Config,
  health: HealthReport,
  token: string,
): Promise<ServerHandle> {
  const app = Fastify({ logger: false })
  const poller = new DashboardPoller(config.pollIntervalMs, config.perColumnLimit)
  const sessions = new SessionManager()

  await app.register(fastifyWebsocket)

  // Everything under /api and /ws needs the shared secret; the static bundle
  // does not, so a plain browser visit can still render the "paste your token"
  // screen instead of a bare 401.
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url
    if (!url.startsWith('/api') && !url.startsWith('/ws')) return

    if (!originAllowed(request.headers.origin, config.port)) {
      return reply.code(403).send({ ok: false, message: 'Forbidden origin' })
    }

    const given =
      request.headers['x-shazam-token'] ??
      (request.query as { t?: string } | undefined)?.t
    if (!tokenMatches(token, given)) {
      return reply.code(401).send({ ok: false, message: 'Invalid or missing shazam token' })
    }
  })

  registerApiRoutes(app, { poller, sessions, health })
  registerPtyRoute(app, sessions)

  if (existsSync(join(WEB_ROOT, 'index.html'))) {
    await app.register(fastifyStatic, { root: WEB_ROOT })
    // SPA fallback so a deep link or a reload does not 404.
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/ws')) {
        return reply.code(404).send({ ok: false, message: 'Not found' })
      }
      return reply.sendFile('index.html')
    })
  } else {
    app.get('/', async (_request, reply) =>
      reply
        .type('text/plain')
        .send('shazam: no web build found. Run `npm run build:web`, or use `npm run dev`.'),
    )
  }

  poller.start()
  await app.listen({ port: config.port, host: '127.0.0.1' })

  return {
    app,
    poller,
    sessions,
    url: `http://127.0.0.1:${config.port}`,
    stop: async () => {
      poller.stop()
      sessions.closeAll()
      await app.close()
    },
  }
}
