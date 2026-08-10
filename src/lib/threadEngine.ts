import { CLI_ROSTER, type RosterAgent } from "./roster";
import { resolveMentions } from "./mentions";
import type { ThreadMessage } from "./ghost";

/**
 * How a turn is run. Only one value exists in this block, and it means
 * "read-only discussion".
 *
 * It is a parameter rather than a hard-coded flag because a later block's
 * writing turn is not a different prompt or a different agent — it is a
 * different way of running the same turn (in a git worktree, with writes
 * allowed). A literal here would mean changing this signature and every test
 * around it later.
 */
export type TurnMode = "discuss";

export type ThreadTurn = { agentId: string; hop: number; mode: TurnMode };

export type EngineDeps = {
  runTurn: (agent: RosterAgent, transcript: ThreadMessage[], mode: TurnMode) => Promise<string>;
  appendMessage: (m: { author: string; body: string; mentions: string[]; hop: number }) => Promise<void>;
  loadTranscript: () => Promise<ThreadMessage[]>;
  isStopped: () => Promise<boolean>;
};

/**
 * The hard bound on a single run of the loop.
 *
 * Deliberately enforced here and not in the prompt: a prompt asking an agent to
 * stop after five turns is a request a model may ignore, while a counter in the
 * loop is a property of the system. Every hop is a real CLI invocation against
 * the operator's own subscription.
 */
export const MAX_HOPS = 5;

/**
 * Ceiling on a stored failure message.
 *
 * A failed turn becomes a message, and every message is replayed into every
 * later prompt — so an unbounded error body compounds. A CLI that echoes its
 * prompt on failure writes the transcript back into the transcript, and the
 * next failure echoes that. Measured on a live run: 2,720 characters at hop 1,
 * 5,449 at hop 2, doubling each time.
 */
const MAX_FAILURE_CHARS = 300;

function failureNote(e: unknown): string {
  const msg = e instanceof Error ? e.message : "failed";
  return msg.length > MAX_FAILURE_CHARS ? `${msg.slice(0, MAX_FAILURE_CHARS)}… [truncated]` : msg;
}

export async function runThread(seed: ThreadTurn[], deps: EngineDeps): Promise<void> {
  const queue: ThreadTurn[] = [...seed];
  let taken = 0;

  while (queue.length > 0 && taken < MAX_HOPS) {
    if (await deps.isStopped()) return;

    const turn = queue.shift()!;
    const agent = CLI_ROSTER.find((a) => a.id === turn.agentId);
    if (!agent) continue;

    taken++;
    const transcript = await deps.loadTranscript();

    let body: string;
    let mentions: string[] = [];
    try {
      body = await deps.runTurn(agent, transcript, turn.mode);
      // Resolve before storing so the record says who was actually queued,
      // not who the text appeared to name.
      mentions = resolveMentions(body, agent.id).map((a) => a.id);
    } catch (e) {
      // A failed turn is part of the conversation, not the end of it: the next
      // agent can see that this one was unavailable.
      body = failureNote(e);
    }

    await deps.appendMessage({ author: agent.id, body, mentions, hop: turn.hop });

    for (const id of mentions) {
      queue.push({ agentId: id, hop: turn.hop + 1, mode: turn.mode });
    }
  }
}
