import { ClaudeAgent } from "./claude-agent";
import { CodexAgent } from "./codex-agent";
import type { AgentConfig } from "./types";

export type AgentName = "claude" | "codex";

const agents = {
  claude: () => new ClaudeAgent(),
  codex: () => new CodexAgent(),
} as const;

export function getAgent(name: AgentName) {
  const factory = agents[name];
  if (!factory) throw new Error(`Unknown agent: ${name}`);
  return factory();
}

export function getReviewer() {
  return getAgent("claude");
}

export function getValidator() {
  return getAgent("codex");
}

export function listAgents(): AgentConfig[] {
  return [
    { name: "claude", displayName: "Claude", color: "#D97706", command: ["claude"], timeoutMs: 300_000 },
    { name: "codex", displayName: "Codex", color: "#10B981", command: ["codex"], timeoutMs: 300_000 },
  ];
}
