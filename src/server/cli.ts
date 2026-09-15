#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { Command } from 'commander'
import { loadOrCreateToken } from './auth.js'
import { loadConfig } from './config.js'
import { startServer } from './index.js'
import { printPreflight, runPreflight } from './preflight.js'

const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  execFile(command, [url], (err) => {
    if (err) console.log(`  ${DIM}(could not open a browser automatically)${RESET}`)
  })
}

const program = new Command()

program
  .name('shazam')
  .description('A single pane for the GitHub work you owe')
  .version('0.1.0')

program
  .command('serve', { isDefault: true })
  .description('Run the dashboard locally')
  .option('-p, --port <number>', 'port to listen on', (v) => Number.parseInt(v, 10))
  .option('-i, --poll <ms>', 'poll interval in milliseconds', (v) => Number.parseInt(v, 10))
  .option('--no-open', 'do not open a browser')
  .option('--skip-preflight', 'start even if required tools are missing')
  .action(async (options: { port?: number; poll?: number; open: boolean; skipPreflight?: boolean }) => {
    const config = loadConfig({ port: options.port, pollIntervalMs: options.poll })

    console.log(`\n${BOLD}shazam${RESET} ${DIM}checking your toolchain${RESET}`)
    const preflight = await runPreflight(
      config.pollIntervalMs,
      config.terminalFontSize,
      config.defaultMergeMethod,
      config.defaultAgent,
    )
    printPreflight(preflight)

    if (!preflight.ok && !options.skipPreflight) {
      console.error(
        `  ${BOLD}Cannot start.${RESET} Fix the items marked ✗ above, or pass --skip-preflight.\n`,
      )
      process.exitCode = 1
      return
    }

    const token = loadOrCreateToken()
    const server = await startServer(config, preflight, token)
    const url = `${server.url}/?t=${token}`

    console.log(`  ${BOLD}Dashboard${RESET}  ${url}`)
    console.log(`  ${DIM}polling every ${Math.round(config.pollIntervalMs / 1000)}s`)
    console.log(`  config     ${config.configPath}${RESET}\n`)

    if (options.open) openBrowser(url)

    let stopping = false
    const shutdown = async () => {
      if (stopping) return
      stopping = true
      console.log('\nshazam: shutting down')
      await server.stop()
      process.exit(0)
    }
    process.on('SIGINT', () => void shutdown())
    process.on('SIGTERM', () => void shutdown())
  })

await program.parseAsync(process.argv)
