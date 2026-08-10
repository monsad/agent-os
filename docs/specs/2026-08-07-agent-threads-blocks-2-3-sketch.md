# Agent Threads — blocks 2 and 3 (sketch)

**Date:** 2026-08-07
**Status:** sketch — not designed, not approved, not scheduled

Companion to [the block 1 design](./2026-08-07-agent-threads-design.md).

These are deliberately sketches rather than specs. Their purpose is to answer one
question — *does block 1 close any doors?* — and to record the reasoning while it
is fresh. Neither is ready to build, and block 3 explicitly should not be built
until block 1 has been in daily use.

---

## Block 2 — Acting agents

**What it adds:** a thread can end in a code change, not only a conclusion.

Today a conversation ends with "we agree, add an index on `thread_messages`" and
the operator does it by hand. Block 2 adds the last step: an agent is told to do
it, works in its own git worktree, and the diff arrives back in the thread for
approval.

### Mechanics

A weighted mention: `@claude implement`. The engine reads it as a **writing
turn** — the second value of the turn mode that block 1 already threads through
the loop. Instead of running the agent read-only against the repository, it:

1. `createWorktree(repoPath, runId)`
2. runs the agent in write mode inside that worktree
3. `diffWorktree(wt)`
4. posts the diff back into the thread as a message

Approval reuses the existing `applyWorktree` / `removeWorktree` paths.

### Most of this already exists

`src/lib/worktree.ts` has the full set of primitives — create, diff, apply,
remove, plus `listStaleWorktrees` and the startup sweep in
`instrumentation-node.ts`. Variants already drives them, including the coloured
diff review in the UI.

So block 2 is mostly wiring existing pieces into the thread loop, not new
machinery. It is smaller than it sounds.

### The one new decision

**A writing turn cannot mention anyone.** It ends the thread and waits for the
operator's apply or discard.

A chain where one agent writes, then a second writes on top of the same worktree,
produces a diff nobody authored in full and which is hard to unwind. The value of
Variants is that each agent's work is separable; a writing chain destroys exactly
that property.

### Open questions

- Does a writing turn get its own worktree per turn, or one per thread?
- What happens to the worktree if the operator never decides? (The startup sweep
  removes stale ones, but the thread would still reference it.)
- Should the diff be posted in full, or summarised with a link to the review UI?
  A large diff inside a transcript that is replayed into every later prompt would
  consume the context window fast.

---

## Block 3 — Unattended work

**What it adds:** a thread starts and runs while the operator is away; they come
back to a finished transcript.

### Why this one is hard

Not technically. Technically it is a background task plus a notification.

It is hard because **it removes the brake the whole of block 1 rests on.**

The five-hop cap is safe because the operator is watching and can press Stop. With
nobody watching, a badly-phrased prompt means five CLI invocations discovered
after the fact — on the bill, or as an exhausted subscription limit. A hop
counter alone stops being a sufficient bound once the human is out of the loop.

### What would have to be added

A **budget** rather than a counter: "this thread gets 10 minutes and 8
invocations, whichever runs out first", enforced hard, with the exhaustion
recorded in the transcript so the operator can see why it stopped rather than
guessing.

Notification on completion — and the honest version of that is notification on
*exhaustion* too, which is the case that actually matters.

### Do this one last

Build it only after blocks 1 and 2 have run for some weeks.

Observability already measures every turn (block 1 gets this for free via
`timedRun`). After a few weeks of real use, the typical and worst-case cost of a
thread is a number that can be read off the dashboard. That number is exactly
what the budget should be set from.

Building block 3 first means guessing it.

---

## Does block 1 close any doors?

Checked against the block 1 design rather than assumed.

### One real risk — addressed

**`readOnly` must not be a literal inside the engine.** If `threadEngine` calls
the agent with `readOnly: true` hard-coded, block 2 forces a change to the
engine's signature and to every test that exercises the loop.

The fix costs nothing today: the engine takes the turn mode as a parameter with a
single value, `"discuss"`. Block 1 behaves identically; block 2 adds a second
value. This is now part of the block 1 design.

This is the only structural door-closer, because it lives in the shape of a
function rather than in data.

### Three that look like door-closers and are not

| Thing | Why it is fine |
|---|---|
| No `kind` column on `thread_messages` | Block 2 adds diff-type events, but `alter table add column` on a single-operator local Postgres is trivial. Adding it now would mean guessing a shape that is not yet known — the sketch above still has open questions about how diffs are stored. |
| "One running thread at a time" (409) | Block 3 turns the refusal into a queue. The check lives in one place, so it is a small substitution rather than a redesign. |
| Polling instead of streaming | Block 3 has nobody to poll for. It needs a notification, which is added alongside rather than instead. |

The asymmetry is the point: data can be migrated cheaply, function signatures
cannot. Only the second kind is worth deciding early.
