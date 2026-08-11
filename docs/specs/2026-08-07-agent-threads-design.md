# Agent Threads — design

**Date:** 2026-08-07
**Status:** approved, not implemented

A shared thread where agents read each other's replies and can hand the floor to
one another by name, and which the operator can re-enter at any point.

Inspired by [Block's Buzz](https://block.xyz/inside/introducing-buzz-where-humans-and-agents-work-together),
adapted to what Agent OS actually is: a single-operator tool driving one-shot CLI
agents on localhost.

---

## Problem

Council already asks every agent the same question, but each one answers blind.
That is deliberate — independent opinions are the whole point of Council, and
they are worth keeping.

What is missing is the other mode: a conversation, where the second agent can
read the first one's answer and disagree with it, build on it, or catch its
mistake. Today that only happens if the operator copies text between terminals
by hand.

## Scope

This is the first of three blocks. It delivers a working agent conversation and
nothing else.

| Block | Adds | Status |
|---|---|---|
| 1. Threads | Read-only conversation with mentions | this document |
| 2. Acting agents | A thread can end in a code change, via worktree isolation | later |
| 3. Unattended work | Thread runs without the operator; notification on completion | later |

---

## The constraint that shapes everything

In Agent OS an agent is a **one-shot process**. `runClaude` executes
`claude -p <prompt>`, reads stdout, and the process exits. The same holds for
`codex exec` and `opencode run`. There is no long-lived agent session to join a
channel.

Buzz assumes the opposite: agents are durable participants with cryptographic
identities on Nostr, independent of any single invocation.

So "agents see each other" is implemented by **replaying the transcript into the
next agent's prompt**. The thread is the durable thing; the agents stay
disposable. No persistent sessions, no Nostr, no identity layer.

This is a smaller claim than Buzz makes, and the design should not pretend
otherwise. What it buys is that the whole feature is a database table and a
loop.

---

## Where it lives

A new **Threads** view, not an extension of Council.

Council's value is precisely that agents *cannot* see each other, which is what
makes its opinions independent. Adding mentions to it would destroy that
property and leave no tool that has it. The two stay separate:

- **Council** — independent opinions, answered blind, side by side
- **Threads** — a conversation, answered in sequence, each agent seeing the rest

---

## Data model

Two new tables. Note that `messages` is **already taken** by chat conversations,
so thread messages get their own table rather than a discriminator column on a
table with a different shape and lifetime.

```sql
create table if not exists threads (
  id          bigserial primary key,
  user_id     bigint not null,
  title       text not null,
  repo_path   text,
  status      text not null default 'idle',   -- idle | running | stopped
  created_at  timestamptz default now()
);

create table if not exists thread_messages (
  id          bigserial primary key,
  thread_id   bigint not null references threads(id) on delete cascade,
  author      text not null,        -- 'human' or a CLI_ROSTER id
  body        text not null,
  mentions    text[] not null default '{}',
  hop         int not null default 0,
  created_at  timestamptz default now()
);

create index if not exists thread_messages_thread_idx
  on thread_messages (thread_id, id);
```

`hop` records how deep in a mention chain a message was produced. It is a
provenance marker for reading the thread back, *not* the thing that bounds the
run — the loop counts total turns taken, so a reply naming two agents spends two
of the budget at the same depth.

`repo_path` is captured per thread, so a thread stays pinned to the repository
it was started against even if the operator attaches a different one later.

`status` has exactly three values. A thread that ends naturally — nobody
mentioned anyone, or the cap was reached — returns to `idle`, the same state it
started in, because it is once again waiting for the operator. `stopped` is
reserved for a thread the operator interrupted, so that "I stopped this" stays
distinguishable from "this finished on its own" when reading the list later.

---

## Modules

Each unit has one job and can be understood without reading the others.

| File | Responsibility | Depends on |
|---|---|---|
| `src/lib/mentions.ts` | Parse `@name` out of text; resolve against the roster | `roster.ts` |
| `src/lib/threads.ts` | CRUD for threads and messages | `ghost.ts` |
| `src/lib/threadEngine.ts` | The turn loop: queue, turn cap, cancellation | injected runner |
| `src/app/api/threads/*` | Thin HTTP layer | the three above |
| `src/components/ThreadsView.tsx` | UI | the API |

`threadEngine` takes the agent runner as a parameter, mirroring how `cliAgent.ts`
takes a `SpawnFn`. That is what makes the loop testable without spawning
anything.

### The turn loop

The opening message must mention at least one agent; `POST /api/threads` returns
400 otherwise. There is no implicit default speaker — picking one for the
operator would mean guessing, and a thread that silently runs the wrong agent is
worse than one that refuses to start.

```
queue ← speakers mentioned in the human's opening message, each with a turn mode
while queue is not empty and turns_taken < MAX_TURNS:
    speaker, mode ← queue.shift()
    prompt        ← system preamble + full transcript so far
    reply         ← run speaker in `mode`, inside timedRun
    persist reply with hop = current hop
    queue         ← queue + (mentions in reply, resolved against the roster)
    if the thread was stopped: break
```

Termination is therefore either: nobody mentioned anyone (the natural end), the
cap was hit, or the operator pressed Stop.

### Turn mode is a parameter, not a literal

Every turn carries a **mode**. In this block there is exactly one value,
`"discuss"`, which runs the agent read-only — so the observable behaviour is
identical to hard-coding it.

It is a parameter anyway, because it is the one decision here that later blocks
cannot route around. Block 2 introduces a writing turn, which is not a different
prompt or a different agent but a different *way of running the same turn*: in a
git worktree, with writes allowed. If `readOnly: true` were a literal inside the
loop, adding that would mean changing the engine's signature and every test that
exercises it.

A discriminator column can be added to a table later with one `alter table`. A
parameter threaded through a loop and its call sites cannot be retrofitted as
cheaply. That asymmetry is the whole reason this one is decided now and the
others are not.

### Prompt shape

The transcript is rendered by speaker name:

```
Human: should we cache the goals query?
Claude: Probably not — the table is tiny and …
Codex: I disagree with Claude on one point …
```

followed by an instruction that the agent may hand the floor to a named
participant with `@name`, and should only do so when it genuinely wants another
agent's input.

The instruction is a request. The cap is the guarantee. See below.

---

## Three safeguards

**Hard cap of 5 agent turns per run, enforced in the engine.** Not in the prompt. A
prompt asking an agent to stop after five turns is a request that a model may
ignore; a counter in the loop is a property of the system. Every turn is a real
`claude -p` or `codex exec` invocation against the operator's own subscription,
so an unbounded chain has a direct cost.

**Mentions resolve only to known roster ids.** `@codex` runs Codex; `@anything`
is ignored and recorded as text. This is not cosmetic. Agents read the attached
repository, so without this rule, text inside a source file, a README, or a test
fixture could name a process to launch. A mention is a selection from a closed
list, never a command name.

**One running thread at a time.** Two concurrent threads at five hops each is
ten parallel CLI invocations. Starting a thread while another is `running`
returns 409.

---

## Decisions taken deliberately

### Agents are read-only

Same posture as Council and Delegate today: `--permission-mode plan` for Claude,
`--sandbox read-only` for Codex.

A conversation about code does not require writing code, and an agent that can
write to the repository inside a loop the operator is not clicking through is a
materially different risk class. Writing stays in Variants, where each agent
works in its own git worktree and the operator picks the winner.

This is narrower than Buzz, which lets agents execute approved automations.
Block 2 is where that gap closes, on top of the worktree isolation that already
exists — which is why the turn mode above is a parameter with one value rather
than a hard-coded flag.

### Polling, not streaming

The UI polls every 2 seconds while a thread is `running`.

Streaming partial output from three concurrent CLI processes is its own problem.
Given that a single turn takes tens of seconds, polling is indistinguishable to
the operator and an order of magnitude less code. If turns get faster, this can
change without touching the data model.

---

## What comes free

Every turn runs inside `timedRun`, so **Observability starts measuring thread
turns with no additional work** — success rate, latency and timeouts per agent,
alongside the existing council and delegate numbers. Threads also get a
`batchId`, matching how council groups its runs today.

---

## API

| Route | Purpose |
|---|---|
| `POST /api/threads` | Create a thread from an opening message; start the loop |
| `GET /api/threads` | List the operator's threads |
| `GET /api/threads/[id]` | Thread with all messages (the polling endpoint) |
| `POST /api/threads/[id]/messages` | Operator replies; re-enters and restarts the loop |
| `POST /api/threads/[id]/stop` | Set status to `stopped`; the loop breaks after the current turn |

All use `readJson`/`invalidJson` and are gated by the existing session check.

Stop cannot kill an in-flight CLI process mid-turn — it takes effect at the next
hop boundary. The UI should say "stopping after this turn", not "stopped",
until the status actually flips.

### Re-entry

An operator reply is just another message with `author = 'human'`, at `hop = 0`.
It resets the hop counter, because the operator's attention is the thing the cap
exists to protect: if they are present and typing, the runaway risk the cap
guards against is not occurring.

---

## Testing

`mentions.ts` is pure — parsing and resolution test trivially.

`threadEngine` receives its runner as a parameter, so the loop is tested with a
fake that returns canned replies. No process is spawned:

- the turn cap holds when every reply mentions someone
- Stop halts the loop at the next hop boundary
- an unknown mention is ignored rather than resolved
- one agent failing records the failure and lets the thread continue
- a reply mentioning nobody ends the thread naturally
- the human's reply resets `hop`

Route tests follow the existing mocked-store pattern used by `council` and
`delegate`. The 409 on a second concurrent thread is covered there.

---

## Out of scope

- Persistent agent identities (Buzz's Nostr layer)
- Agents writing to the repository — block 2
- Notifications and unattended runs — block 3
- Voice, media, or file attachments in threads
- More than one operator; the single-operator scope in the README is unchanged
