import type { CliBackend } from "./cliAgent";

// Single source of truth for which CLI agents take part in fan-out
// (council / delegate / review / variants). It used to be copy-pasted into each
// of those routes plus the variants UI, so removing an agent meant finding six
// places and dropping one was a silent behaviour difference between features.
//
// Not to be confused with components/agents.ts: that is the dashboard's display
// registry (taglines, accents, status) and covers non-CLI agents like Ollama and
// Hermes too. This is only "who can be handed a task in parallel".
//
// Gemini is excluded: Google retired the free Gemini Code Assist CLI tier for
// individuals (IneligibleTierError). Add it back here if a GEMINI_API_KEY is
// configured — one edit, and every fan-out feature picks it up.
export type RosterAgent = { id: string; name: string; backend: CliBackend };

export const CLI_ROSTER: readonly RosterAgent[] = [
  { id: "claude", name: "Claude", backend: "claude" },
  { id: "codex", name: "Codex", backend: "codex" },
  { id: "openclaw", name: "OpenClaw", backend: "opencode" },
];

/**
 * Resolve a caller-supplied list of agent ids against the roster. An empty or
 * missing selection means "all of them", which is what every fan-out endpoint
 * wants; unknown ids are ignored rather than erroring, so a stale client can't
 * break a run.
 */
export function selectAgents(ids?: string[]): RosterAgent[] {
  if (!ids?.length) return [...CLI_ROSTER];
  return CLI_ROSTER.filter((a) => ids.includes(a.id));
}
