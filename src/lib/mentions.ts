import { CLI_ROSTER, type RosterAgent } from "./roster";

// Requires a boundary before the @, so "someone@example.com" is an address
// rather than a mention of "example".
const MENTION = /(?:^|[^\w@])@([a-z0-9_-]+)/gi;

/** Every distinct @name in the text, lowercased, in order of first appearance. */
export function parseMentions(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(MENTION)) found.add(m[1].toLowerCase());
  return [...found];
}

/**
 * Resolve mentions to actual agents.
 *
 * Unknown names are dropped rather than erroring: agents read whatever
 * repository is attached, so a name appearing in a source file, a README or a
 * test fixture must not be able to launch anything. A mention is a selection
 * from a closed list, never a command name.
 *
 * `speaker` is dropped too — an agent handing the floor to itself is a wasted
 * invocation that the hop cap would silently absorb.
 */
export function resolveMentions(text: string, speaker?: string): RosterAgent[] {
  const names = parseMentions(text);
  return CLI_ROSTER.filter((a) => names.includes(a.id) && a.id !== speaker);
}
