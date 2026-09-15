import type { AgentId, HealthReport } from '../../shared/types.js'

export type AgentInfo = HealthReport['agents'][number]

/**
 * The agent a plain Shazam click opens: the one named by `defaultAgent` in the
 * config when it is actually installed, and otherwise whatever else is. Shared
 * so that the Shazam button and the wrench cannot drift apart on the answer.
 */
export function primaryAgent(agents: AgentInfo[], preferred: AgentId): AgentInfo | undefined {
  const available = agents.filter((agent) => agent.available)
  return available.find((agent) => agent.id === preferred) ?? available[0]
}
