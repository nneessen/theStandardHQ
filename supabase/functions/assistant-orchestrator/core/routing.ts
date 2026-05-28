// Intent -> agent routing (pure). MVP wires a single agent (executive-briefing)
// that handles every request; the routing seam exists so later phases can classify
// intent and dispatch to specialized agents without restructuring the orchestrator.

import type { AgentKey } from "./types.ts";

const DEFAULT_AGENT: AgentKey = "executive-briefing";

export function routeToAgent(
  _userMessage: string,
  enabledAgents: AgentKey[] = [DEFAULT_AGENT],
): AgentKey {
  if (enabledAgents.includes(DEFAULT_AGENT)) return DEFAULT_AGENT;
  return enabledAgents[0] ?? DEFAULT_AGENT;
}
