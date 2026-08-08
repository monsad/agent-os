import { CLI_ROSTER } from "./roster";
import type { ThreadMessage } from "./ghost";

/** Display name for a transcript line. Unknown ids print as themselves. */
export function displayName(author: string): string {
  if (author === "human") return "Human";
  return CLI_ROSTER.find((a) => a.id === author)?.name ?? author;
}

/** The whole thread so far, as the agent will read it. */
export function renderTranscript(messages: ThreadMessage[]): string {
  return messages.map((m) => `${displayName(m.author)}: ${m.body}`).join("\n\n");
}

/**
 * The prompt for one turn.
 *
 * The hand-off instruction is a request; the hop cap in the engine is the
 * guarantee. Nothing here is load-bearing for safety.
 */
export function buildTurnPrompt(messages: ThreadMessage[], speakerId: string): string {
  const me = CLI_ROSTER.find((a) => a.id === speakerId);
  const others = CLI_ROSTER.filter((a) => a.id !== speakerId);
  const handoffs = others.map((a) => `@${a.id} (${a.name})`).join(", ");

  return [
    `You are ${me?.name ?? speakerId}, taking part in a conversation with a human and other AI agents.`,
    ``,
    `The conversation so far:`,
    ``,
    renderTranscript(messages),
    ``,
    `Reply as yourself. You have read the whole thread, so build on what has already been said`,
    `rather than repeating it — agree, disagree, or correct, and say which.`,
    ``,
    `If you want another agent's input, hand them the floor by writing their handle: ${handoffs}.`,
    `Only do that when you genuinely want their view; a thread that ends is fine.`,
    `Keep your reply under 250 words.`,
  ].join("\n");
}
