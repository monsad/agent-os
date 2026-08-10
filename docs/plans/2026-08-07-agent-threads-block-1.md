# Agent Threads (block 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A thread where agents read each other's replies and hand the floor to one another by name, and which the operator can re-enter at any time.

**Architecture:** Agents stay one-shot CLI processes. "Seeing each other" is implemented by replaying the thread transcript into the next agent's prompt. A turn loop pops a speaker off a queue, runs it, parses `@mentions` out of the reply, and pushes the mentioned agents back on — bounded by a hard hop cap in the loop, not in the prompt. Every turn goes through `timedRun`, so Observability measures threads for free.

**Tech Stack:** Next.js 16 App Router, TypeScript, Postgres (via `pg`), Vitest.

**Spec:** [`docs/specs/2026-08-07-agent-threads-design.md`](../specs/2026-08-07-agent-threads-design.md)

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/mentions.ts` | Parse `@name` from text; resolve against the roster. Pure. |
| `src/lib/threadPrompt.ts` | Render a transcript and build a turn prompt. Pure. |
| `src/lib/threadEngine.ts` | The turn loop: queue, hop cap, stop check. All I/O injected. |
| `src/lib/ghost.ts` | Add `threads` / `thread_messages` tables and their CRUD (modify). |
| `docker/init-schema.sql` | Same two tables, for a fresh container (modify). |
| `src/app/api/threads/route.ts` | Create and list threads. |
| `src/app/api/threads/[id]/route.ts` | Read one thread with its messages (the polling endpoint). |
| `src/app/api/threads/[id]/messages/route.ts` | Operator reply; restarts the loop. |
| `src/app/api/threads/[id]/stop/route.ts` | Request a stop. |
| `src/components/ThreadsView.tsx` | UI. |
| `src/components/Sidebar.tsx` | Add the nav entry (modify). |

The three pure modules hold all the logic worth testing. The routes stay thin, matching `council/route.ts`.

---

### Task 1: Mention parsing

**Files:**
- Create: `src/lib/mentions.ts`
- Test: `src/lib/mentions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mentions.test.ts
import { describe, it, expect } from "vitest";
import { parseMentions, resolveMentions } from "./mentions";

describe("parseMentions", () => {
  it("pulls names out of a reply", () => {
    expect(parseMentions("I think @codex should check the index")).toEqual(["codex"]);
  });

  it("lowercases so @Codex and @codex are the same agent", () => {
    expect(parseMentions("@Codex and @OPENCLAW")).toEqual(["codex", "openclaw"]);
  });

  it("returns each name once even if mentioned repeatedly", () => {
    expect(parseMentions("@codex ... and again @codex")).toEqual(["codex"]);
  });

  it("ignores an email address, which is not a mention", () => {
    expect(parseMentions("mail me at someone@example.com")).toEqual([]);
  });

  it("returns nothing for text with no mentions", () => {
    expect(parseMentions("no one in particular")).toEqual([]);
  });
});

describe("resolveMentions", () => {
  it("resolves known names to roster agents", () => {
    expect(resolveMentions("ask @codex").map((a) => a.id)).toEqual(["codex"]);
  });

  // The safety rule: agents read the attached repo, so text in a source file
  // must never be able to name a process to launch.
  it("drops names that are not on the roster", () => {
    expect(resolveMentions("@rm-rf and @definitely-not-an-agent")).toEqual([]);
  });

  it("drops the speaker's own name so an agent cannot call itself", () => {
    expect(resolveMentions("@claude @codex", "claude").map((a) => a.id)).toEqual(["codex"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/mentions.test.ts`
Expected: FAIL — `Failed to resolve import "./mentions"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/mentions.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/mentions.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/mentions.ts src/lib/mentions.test.ts
git commit -m "feat(threads): parse and resolve agent mentions"
```

---

### Task 2: Thread storage

**Files:**
- Modify: `src/lib/ghost.ts`
- Modify: `docker/init-schema.sql`
- Test: `src/lib/ghost.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/ghost.test.ts`:

```ts
describe("threads", () => {
  it("initSchema creates both thread tables", async () => {
    const pool = fakePool();
    const store = createStore(pool as never);
    await store.initSchema();
    const sql = pool.query.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).toMatch(/create table if not exists threads/i);
    expect(sql).toMatch(/create table if not exists thread_messages/i);
  });

  it("createThread binds the title rather than interpolating it", async () => {
    const pool = fakePool([{ id: 7 }]);
    const store = createStore(pool as never);
    await store.createThread(1, "o'brien's idea", "/repos/app");
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).not.toContain("o'brien");
    expect(params).toEqual([1, "o'brien's idea", "/repos/app"]);
  });

  it("addThreadMessage stores mentions and hop", async () => {
    const pool = fakePool([{ id: 3 }]);
    const store = createStore(pool as never);
    await store.addThreadMessage(7, { author: "claude", body: "ask @codex", mentions: ["codex"], hop: 1 });
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/insert into thread_messages/i);
    expect(params).toEqual([7, "claude", "ask @codex", ["codex"], 1]);
  });

  // Threads are per-operator, like goals.
  it("getThread scopes the lookup to the owner", async () => {
    const pool = fakePool([]);
    const store = createStore(pool as never);
    await store.getThread(1, 7);
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/user_id = \$1/);
    expect(params).toEqual([1, 7]);
  });

  it("hasRunningThread asks only for this operator's running threads", async () => {
    const pool = fakePool([{ id: 2 }]);
    const store = createStore(pool as never);
    expect(await store.hasRunningThread(1)).toBe(true);
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/status = 'running'/);
    expect(params).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ghost.test.ts`
Expected: FAIL — `store.createThread is not a function`

- [ ] **Step 3: Write minimal implementation**

Add the types near the other exported types at the top of `src/lib/ghost.ts`:

```ts
export type ThreadStatus = "idle" | "running" | "stopped";

export type Thread = {
  id: number;
  user_id: number;
  title: string;
  repo_path: string | null;
  status: ThreadStatus;
  created_at: string;
};

export type ThreadMessage = {
  id: number;
  thread_id: number;
  author: string; // 'human' or a CLI_ROSTER id
  body: string;
  mentions: string[];
  hop: number;
  created_at: string;
};
```

Inside `initSchema()`, after the `journal_entries` statement:

```ts
      await pool.query(`create table if not exists threads (
        id bigserial primary key,
        user_id bigint not null references users(id),
        title text not null,
        repo_path text,
        status text not null default 'idle',
        created_at timestamptz default now()
      )`);
      await pool.query(`create table if not exists thread_messages (
        id bigserial primary key,
        thread_id bigint not null references threads(id) on delete cascade,
        author text not null,
        body text not null,
        mentions text[] not null default '{}',
        hop int not null default 0,
        created_at timestamptz default now()
      )`);
      await pool.query(`create index if not exists thread_messages_thread_idx
        on thread_messages (thread_id, id)`);
```

Add these methods to the object returned by `createStore`:

```ts
    async createThread(userId: number, title: string, repoPath: string | null): Promise<Thread> {
      const { rows } = await pool.query(
        `insert into threads (user_id, title, repo_path) values ($1, $2, $3)
         returning id, user_id, title, repo_path, status, created_at`,
        [userId, title, repoPath],
      );
      return rows[0] as Thread;
    },

    async listThreads(userId: number): Promise<Thread[]> {
      const { rows } = await pool.query(
        `select id, user_id, title, repo_path, status, created_at
           from threads where user_id = $1 order by id desc limit 50`,
        [userId],
      );
      return rows as Thread[];
    },

    async getThread(userId: number, threadId: number): Promise<Thread | null> {
      const { rows } = await pool.query(
        `select id, user_id, title, repo_path, status, created_at
           from threads where user_id = $1 and id = $2`,
        [userId, threadId],
      );
      return (rows[0] as Thread) ?? null;
    },

    async setThreadStatus(threadId: number, status: ThreadStatus): Promise<void> {
      await pool.query(`update threads set status = $2 where id = $1`, [threadId, status]);
    },

    async hasRunningThread(userId: number): Promise<boolean> {
      const { rows } = await pool.query(
        `select id from threads where user_id = $1 and status = 'running' limit 1`,
        [userId],
      );
      return rows.length > 0;
    },

    async addThreadMessage(
      threadId: number,
      m: { author: string; body: string; mentions: string[]; hop: number },
    ): Promise<ThreadMessage> {
      const { rows } = await pool.query(
        `insert into thread_messages (thread_id, author, body, mentions, hop)
         values ($1, $2, $3, $4, $5)
         returning id, thread_id, author, body, mentions, hop, created_at`,
        [threadId, m.author, m.body, m.mentions, m.hop],
      );
      return rows[0] as ThreadMessage;
    },

    async listThreadMessages(threadId: number): Promise<ThreadMessage[]> {
      const { rows } = await pool.query(
        `select id, thread_id, author, body, mentions, hop, created_at
           from thread_messages where thread_id = $1 order by id`,
        [threadId],
      );
      return rows as ThreadMessage[];
    },
```

Append the same two tables to `docker/init-schema.sql`, so a fresh container matches:

```sql
create table if not exists threads (
  id bigserial primary key,
  user_id bigint not null references users(id),
  title text not null,
  repo_path text,
  status text not null default 'idle',
  created_at timestamptz default now()
);

create table if not exists thread_messages (
  id bigserial primary key,
  thread_id bigint not null references threads(id) on delete cascade,
  author text not null,
  body text not null,
  mentions text[] not null default '{}',
  hop int not null default 0,
  created_at timestamptz default now()
);

create index if not exists thread_messages_thread_idx
  on thread_messages (thread_id, id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ghost.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ghost.ts src/lib/ghost.test.ts docker/init-schema.sql
git commit -m "feat(threads): threads and thread_messages storage"
```

---

### Task 3: Transcript rendering and turn prompt

**Files:**
- Create: `src/lib/threadPrompt.ts`
- Test: `src/lib/threadPrompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/threadPrompt.test.ts
import { describe, it, expect } from "vitest";
import { renderTranscript, buildTurnPrompt } from "./threadPrompt";
import type { ThreadMessage } from "./ghost";

function msg(author: string, body: string): ThreadMessage {
  return { id: 1, thread_id: 1, author, body, mentions: [], hop: 0, created_at: "" };
}

describe("renderTranscript", () => {
  it("labels each line with the speaker's display name", () => {
    const out = renderTranscript([msg("human", "should we cache this?"), msg("claude", "probably not")]);
    expect(out).toContain("Human: should we cache this?");
    expect(out).toContain("Claude: probably not");
  });

  it("falls back to the raw id for an author no longer on the roster", () => {
    expect(renderTranscript([msg("gemini", "hi")])).toContain("gemini: hi");
  });
});

describe("buildTurnPrompt", () => {
  it("carries the transcript into the prompt", () => {
    const p = buildTurnPrompt([msg("human", "is the index worth it?")], "codex");
    expect(p).toContain("is the index worth it?");
  });

  it("names the other participants the agent may hand off to, but not itself", () => {
    const p = buildTurnPrompt([msg("human", "hi")], "codex");
    expect(p).toContain("@claude");
    expect(p).toContain("@openclaw");
    expect(p).not.toContain("@codex");
  });

  it("tells the agent who it is", () => {
    expect(buildTurnPrompt([msg("human", "hi")], "codex")).toContain("You are Codex");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/threadPrompt.test.ts`
Expected: FAIL — `Failed to resolve import "./threadPrompt"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/threadPrompt.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/threadPrompt.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/threadPrompt.ts src/lib/threadPrompt.test.ts
git commit -m "feat(threads): transcript rendering and turn prompt"
```

---

### Task 4: The turn loop

**Files:**
- Create: `src/lib/threadEngine.ts`
- Test: `src/lib/threadEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/threadEngine.test.ts
import { describe, it, expect, vi } from "vitest";
import { runThread, MAX_HOPS, type EngineDeps } from "./threadEngine";
import type { ThreadMessage } from "./ghost";

/** Deps wired to canned replies. Nothing spawns a process. */
function deps(replies: Record<string, string>, over: Partial<EngineDeps> = {}) {
  const written: { author: string; body: string; hop: number }[] = [];
  const base: EngineDeps = {
    runTurn: vi.fn(async (agent) => replies[agent.id] ?? "nothing to add"),
    appendMessage: vi.fn(async (m) => {
      written.push({ author: m.author, body: m.body, hop: m.hop });
    }),
    loadTranscript: vi.fn(async () => [] as ThreadMessage[]),
    isStopped: vi.fn(async () => false),
  };
  return { deps: { ...base, ...over }, written };
}

describe("runThread", () => {
  it("runs the seeded speaker and stops when nobody is mentioned", async () => {
    const { deps: d, written } = deps({ claude: "here is my view" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ author: "claude", hop: 1 });
  });

  it("follows a mention to the next agent", async () => {
    const { deps: d, written } = deps({ claude: "not sure, @codex what do you think?", codex: "I agree" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written.map((w) => w.author)).toEqual(["claude", "codex"]);
    expect(written[1].hop).toBe(2);
  });

  // The safety property. Every reply mentions someone, so only the cap ends it.
  it("stops at the hop cap when agents keep handing off", async () => {
    const { deps: d, written } = deps({ claude: "@codex ?", codex: "@claude ?" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written).toHaveLength(MAX_HOPS);
  });

  it("ignores a mention of something that is not an agent", async () => {
    const { deps: d, written } = deps({ claude: "run @rm-rf now" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written).toHaveLength(1);
  });

  it("halts at the next hop boundary once stopped", async () => {
    const { deps: d, written } = deps(
      { claude: "@codex ?", codex: "@claude ?" },
      { isStopped: vi.fn(async () => true) },
    );
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written).toHaveLength(1);
  });

  // One agent being logged out must not cost the rest of the conversation.
  it("records a failing turn and carries on", async () => {
    const { deps: d, written } = deps(
      { codex: "picking up where Claude left off" },
      {
        runTurn: vi.fn(async (agent) => {
          if (agent.id === "claude") throw new Error("claude exited 1");
          return "picking up where Claude left off";
        }),
      },
    );
    await runThread(
      [
        { agentId: "claude", hop: 1, mode: "discuss" },
        { agentId: "codex", hop: 1, mode: "discuss" },
      ],
      d,
    );
    expect(written).toHaveLength(2);
    expect(written[0].body).toContain("claude exited 1");
  });

  it("passes the turn mode through to the runner", async () => {
    const { deps: d } = deps({ claude: "ok" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(d.runTurn).toHaveBeenCalledWith(expect.objectContaining({ id: "claude" }), [], "discuss");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/threadEngine.test.ts`
Expected: FAIL — `Failed to resolve import "./threadEngine"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/threadEngine.ts
import { CLI_ROSTER, type RosterAgent } from "./roster";
import { resolveMentions } from "./mentions";
import type { ThreadMessage } from "./ghost";

/**
 * How a turn is run. Only one value exists in this block, and it means
 * "read-only discussion".
 *
 * It is a parameter rather than a hard-coded flag because block 2's writing
 * turn is not a different prompt or a different agent — it is a different way
 * of running the same turn (in a git worktree, with writes allowed). A literal
 * here would mean changing this signature and every test around it later.
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
      body = e instanceof Error ? e.message : "failed";
    }

    await deps.appendMessage({ author: agent.id, body, mentions, hop: turn.hop });

    for (const id of mentions) {
      queue.push({ agentId: id, hop: turn.hop + 1, mode: turn.mode });
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/threadEngine.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/threadEngine.ts src/lib/threadEngine.test.ts
git commit -m "feat(threads): turn loop with hop cap and stop"
```

---

### Task 5: Wiring the engine to real agents

**Files:**
- Create: `src/lib/threadRunner.ts`
- Test: `src/lib/threadRunner.test.ts`

This is the one place where the pure engine meets `runCliAgent`, `timedRun` and the store. Keeping it separate is what lets Task 4 stay testable without mocking four modules.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/threadRunner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cliAgent", () => ({ runCliAgent: vi.fn() }));
vi.mock("@/lib/runs", () => ({
  timedRun: vi.fn((_meta: unknown, fn: () => Promise<unknown>) => fn()),
  newBatchId: vi.fn(() => "batch1"),
}));

import { runCliAgent } from "@/lib/cliAgent";
import { makeTurnRunner } from "./threadRunner";
import type { ThreadMessage } from "./ghost";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  asMock(runCliAgent).mockResolvedValue("my reply");
});

const agent = { id: "codex", name: "Codex", backend: "codex" as const };
const transcript: ThreadMessage[] = [
  { id: 1, thread_id: 1, author: "human", body: "is the index worth it?", mentions: [], hop: 0, created_at: "" },
];

describe("makeTurnRunner", () => {
  it("returns the agent's reply", async () => {
    const run = makeTurnRunner({ repoPath: "/repos/app", batchId: "b1" });
    expect(await run(agent, transcript, "discuss")).toBe("my reply");
  });

  // Block 1 is a conversation about code, not a change to it.
  it("runs the agent read-only against the thread's repo", async () => {
    const run = makeTurnRunner({ repoPath: "/repos/app", batchId: "b1" });
    await run(agent, transcript, "discuss");
    const [, , , opts] = asMock(runCliAgent).mock.calls[0];
    expect(opts).toMatchObject({ cwd: "/repos/app", readOnly: true });
  });

  it("sends the transcript as the prompt", async () => {
    const run = makeTurnRunner({ repoPath: "/repos/app", batchId: "b1" });
    await run(agent, transcript, "discuss");
    const [, messages] = asMock(runCliAgent).mock.calls[0];
    expect(messages[0].content).toContain("is the index worth it?");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/threadRunner.test.ts`
Expected: FAIL — `Failed to resolve import "./threadRunner"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/threadRunner.ts
import { runCliAgent } from "@/lib/cliAgent";
import { timedRun } from "@/lib/runs";
import { buildTurnPrompt } from "./threadPrompt";
import type { EngineDeps } from "./threadEngine";

/**
 * Build the engine's `runTurn` from the real agent CLIs.
 *
 * Every turn goes through `timedRun`, so Observability picks threads up with no
 * extra work — success rate, latency and timeouts per agent, alongside council
 * and delegate. `batchId` groups the turns of one thread run, matching how
 * council groups a fan-out.
 */
export function makeTurnRunner(ctx: { repoPath: string; batchId: string }): EngineDeps["runTurn"] {
  return async (agent, transcript, mode) => {
    const prompt = buildTurnPrompt(transcript, agent.id);
    return timedRun(
      {
        feature: "threads",
        agent: agent.name,
        backend: agent.backend,
        task: prompt.slice(0, 140),
        repo: ctx.repoPath,
        batchId: ctx.batchId,
      },
      () =>
        runCliAgent(agent.backend, [{ role: "user", content: prompt }], undefined, {
          cwd: ctx.repoPath,
          // `mode` has one value in this block; block 2 branches here.
          readOnly: mode === "discuss",
          timeoutMs: 300_000,
        }),
    );
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/threadRunner.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/threadRunner.ts src/lib/threadRunner.test.ts
git commit -m "feat(threads): wire the turn loop to the agent CLIs"
```

---

### Task 6: Create and list routes

**Files:**
- Create: `src/app/api/threads/route.ts`
- Test: `src/app/api/threads/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/threads/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/repo", () => ({ getRepo: vi.fn() }));
vi.mock("@/lib/ghost", () => ({ getStore: vi.fn() }));
// Mock the loop starter, not the engine. `startLoop` deliberately does not await
// its work, so asserting on `runThread` from here would race the fire-and-forget
// and pass or fail depending on timing.
vi.mock("@/lib/threadLoop", () => ({ startLoop: vi.fn() }));

import { currentUserId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { getStore } from "@/lib/ghost";
import { startLoop } from "@/lib/threadLoop";
import { POST, GET } from "./route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const store = {
  createThread: vi.fn(async () => ({ id: 7, user_id: 1, title: "t", repo_path: "/repos/app", status: "idle", created_at: "" })),
  listThreads: vi.fn(async () => []),
  addThreadMessage: vi.fn(async () => ({})),
  listThreadMessages: vi.fn(async () => []),
  setThreadStatus: vi.fn(async () => {}),
  hasRunningThread: vi.fn(async () => false),
  getThread: vi.fn(async () => null),
};

beforeEach(() => {
  vi.clearAllMocks();
  asMock(currentUserId).mockResolvedValue(1);
  asMock(getRepo).mockReturnValue({ repoPath: "/repos/app" });
  asMock(getStore).mockReturnValue(store);
  store.hasRunningThread.mockResolvedValue(false);
});

function req(body: unknown): Request {
  return new Request("http://test/api/threads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/threads", () => {
  it("401s without a session", async () => {
    asMock(currentUserId).mockResolvedValue(null);
    expect((await POST(req({ message: "@claude hi" }))).status).toBe(401);
  });

  it("400s on an empty message", async () => {
    expect((await POST(req({ message: "  " }))).status).toBe(400);
  });

  // No implicit default speaker: a thread that silently runs the wrong agent is
  // worse than one that refuses to start.
  it("400s when the opening message mentions nobody", async () => {
    const res = await POST(req({ message: "what do we think?" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_mentions");
  });

  it("400s when no repo is attached", async () => {
    asMock(getRepo).mockReturnValue({ repoPath: null });
    expect((await POST(req({ message: "@claude hi" }))).status).toBe(400);
  });

  // Two threads at five hops each is ten parallel CLI invocations.
  it("409s while another thread is running", async () => {
    store.hasRunningThread.mockResolvedValue(true);
    expect((await POST(req({ message: "@claude hi" }))).status).toBe(409);
  });

  it("creates the thread, stores the opening message and starts the loop", async () => {
    const res = await POST(req({ message: "@claude is the index worth it?" }));
    expect(res.status).toBe(201);
    expect((await res.json()).thread.id).toBe(7);
    expect(store.addThreadMessage).toHaveBeenCalledWith(7, expect.objectContaining({ author: "human", hop: 0 }));
    expect(startLoop).toHaveBeenCalled();
  });

  it("seeds the loop with the mentioned agents only", async () => {
    await POST(req({ message: "@codex and @openclaw please" }));
    const [, seed] = asMock(startLoop).mock.calls[0];
    expect(seed.map((t: { agentId: string }) => t.agentId)).toEqual(["codex", "openclaw"]);
  });
});

describe("GET /api/threads", () => {
  it("401s without a session", async () => {
    asMock(currentUserId).mockResolvedValue(null);
    expect((await GET(new Request("http://test/api/threads"))).status).toBe(401);
  });

  it("lists the operator's threads", async () => {
    const res = await GET(new Request("http://test/api/threads"));
    expect(res.status).toBe(200);
    expect(store.listThreads).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/threads/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/threads/route.ts
import { currentUserId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { getStore } from "@/lib/ghost";
import { readJson, invalidJson } from "@/lib/http";
import { resolveMentions } from "@/lib/mentions";
import { newBatchId } from "@/lib/runs";
import type { ThreadTurn } from "@/lib/threadEngine";
import { startLoop } from "@/lib/threadLoop";

export async function GET(request: Request): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ threads: await getStore().listThreads(userId) });
}

export async function POST(request: Request): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await readJson<{ message?: string }>(request);
  if (!body) return invalidJson();
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  const mentioned = resolveMentions(message);
  if (mentioned.length === 0) return Response.json({ error: "no_mentions" }, { status: 400 });

  const repoPath = getRepo().repoPath;
  if (!repoPath) return Response.json({ error: "no_repo" }, { status: 400 });

  const store = getStore();
  if (await store.hasRunningThread(userId)) {
    return Response.json({ error: "thread_already_running" }, { status: 409 });
  }

  const thread = await store.createThread(userId, message.slice(0, 80), repoPath);
  await store.addThreadMessage(thread.id, {
    author: "human",
    body: message,
    mentions: mentioned.map((a) => a.id),
    hop: 0,
  });

  const seed: ThreadTurn[] = mentioned.map((a) => ({ agentId: a.id, hop: 1, mode: "discuss" }));
  startLoop(thread.id, seed, repoPath, newBatchId());

  return Response.json({ thread }, { status: 201 });
}
```

Create the shared starter, used by this route and by Task 7's reply route:

```ts
// src/lib/threadLoop.ts
import { getStore } from "./ghost";
import { runThread, type ThreadTurn } from "./threadEngine";
import { makeTurnRunner } from "./threadRunner";

/**
 * Start a thread run and return immediately; the UI polls for progress.
 *
 * Deliberately not awaited by the route. Agent OS runs as a long-lived Node
 * process (`next start` on the host), not on a serverless platform that would
 * freeze the container once the response is sent, so the loop survives past the
 * HTTP response.
 */
export function startLoop(
  threadId: number,
  seed: ThreadTurn[],
  repoPath: string,
  batchId: string,
): void {
  const store = getStore();
  void (async () => {
    await store.setThreadStatus(threadId, "running");
    try {
      await runThread(seed, {
        runTurn: makeTurnRunner({ repoPath, batchId }),
        appendMessage: (m) => store.addThreadMessage(threadId, m).then(() => undefined),
        loadTranscript: () => store.listThreadMessages(threadId),
        isStopped: async () => (await store.getThreadById(threadId))?.status === "stopped",
      });
    } finally {
      // A thread that ended on its own is waiting for the operator again, which
      // is what `idle` means. `stopped` is left alone so "I interrupted this"
      // stays distinguishable from "this finished".
      const t = await store.getThreadById(threadId);
      if (t?.status !== "stopped") await store.setThreadStatus(threadId, "idle");
    }
  })();
}
```

The loop is bookkeeping on a thread it was handed, not answering a request, so it
needs a lookup that is not owner-scoped. Add it to `src/lib/ghost.ts` next to
`getThread`:

```ts
    async getThreadById(threadId: number): Promise<Thread | null> {
      const { rows } = await pool.query(
        `select id, user_id, title, repo_path, status, created_at from threads where id = $1`,
        [threadId],
      );
      return (rows[0] as Thread) ?? null;
    },
```

Ownership is still enforced — every route checks it via `getThread(userId, id)`
before anything reaches the loop.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/threads/route.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/threads/route.ts src/app/api/threads/route.test.ts src/lib/threadLoop.ts src/lib/ghost.ts
git commit -m "feat(threads): create and list routes"
```

---

### Task 7: Read, reply and stop routes

**Files:**
- Create: `src/app/api/threads/[id]/route.ts`
- Create: `src/app/api/threads/[id]/messages/route.ts`
- Create: `src/app/api/threads/[id]/stop/route.ts`
- Test: `src/app/api/threads/[id]/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/threads/[id]/route.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/ghost", () => ({ getStore: vi.fn() }));
vi.mock("@/lib/threadLoop", () => ({ startLoop: vi.fn() }));

import { currentUserId } from "@/lib/auth";
import { getStore } from "@/lib/ghost";
import { startLoop } from "@/lib/threadLoop";
import { GET } from "./route";
import { POST as REPLY } from "./messages/route";
import { POST as STOP } from "./stop/route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const thread = { id: 7, user_id: 1, title: "t", repo_path: "/repos/app", status: "idle", created_at: "" };
const store = {
  getThread: vi.fn(async () => thread),
  listThreadMessages: vi.fn(async () => []),
  addThreadMessage: vi.fn(async () => ({})),
  setThreadStatus: vi.fn(async () => {}),
  hasRunningThread: vi.fn(async () => false),
};

beforeEach(() => {
  vi.clearAllMocks();
  asMock(currentUserId).mockResolvedValue(1);
  asMock(getStore).mockReturnValue(store);
  store.getThread.mockResolvedValue(thread);
});

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) =>
  new Request("http://test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("GET /api/threads/[id]", () => {
  it("401s without a session", async () => {
    asMock(currentUserId).mockResolvedValue(null);
    expect((await GET(new Request("http://test"), params("7"))).status).toBe(401);
  });

  // Owner scoping is what stops one operator reading another's thread.
  it("404s for a thread the caller does not own", async () => {
    store.getThread.mockResolvedValue(null);
    expect((await GET(new Request("http://test"), params("7"))).status).toBe(404);
  });

  it("returns the thread with its messages", async () => {
    const res = await GET(new Request("http://test"), params("7"));
    expect(res.status).toBe(200);
    expect((await res.json()).thread.id).toBe(7);
    expect(store.listThreadMessages).toHaveBeenCalledWith(7);
  });
});

describe("POST /api/threads/[id]/messages", () => {
  it("400s when the reply mentions nobody", async () => {
    const res = await REPLY(post({ message: "thanks" }), params("7"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_mentions");
  });

  // The operator is present and typing, so the risk the cap guards against is
  // not occurring: the reply starts a fresh run at hop 0.
  it("stores the reply at hop 0 and restarts the loop", async () => {
    const res = await REPLY(post({ message: "@claude why not?" }), params("7"));
    expect(res.status).toBe(201);
    expect(store.addThreadMessage).toHaveBeenCalledWith(7, expect.objectContaining({ author: "human", hop: 0 }));
    expect(startLoop).toHaveBeenCalled();
  });

  it("409s while the thread is still running", async () => {
    store.getThread.mockResolvedValue({ ...thread, status: "running" });
    expect((await REPLY(post({ message: "@claude hi" }), params("7"))).status).toBe(409);
  });
});

describe("POST /api/threads/[id]/stop", () => {
  it("marks the thread stopped", async () => {
    const res = await STOP(new Request("http://test", { method: "POST" }), params("7"));
    expect(res.status).toBe(200);
    expect(store.setThreadStatus).toHaveBeenCalledWith(7, "stopped");
  });

  it("404s for a thread the caller does not own", async () => {
    store.getThread.mockResolvedValue(null);
    expect((await STOP(new Request("http://test", { method: "POST" }), params("7"))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/threads/[id]/route.test.ts"`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/threads/[id]/route.ts
import { currentUserId } from "@/lib/auth";
import { getStore } from "@/lib/ghost";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "bad id" }, { status: 400 });

  const store = getStore();
  const thread = await store.getThread(userId, id);
  if (!thread) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ thread, messages: await store.listThreadMessages(id) });
}
```

```ts
// src/app/api/threads/[id]/messages/route.ts
import { currentUserId } from "@/lib/auth";
import { getStore } from "@/lib/ghost";
import { readJson, invalidJson } from "@/lib/http";
import { resolveMentions } from "@/lib/mentions";
import { newBatchId } from "@/lib/runs";
import { startLoop } from "@/lib/threadLoop";
import type { ThreadTurn } from "@/lib/threadEngine";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "bad id" }, { status: 400 });

  const body = await readJson<{ message?: string }>(request);
  if (!body) return invalidJson();
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  const mentioned = resolveMentions(message);
  if (mentioned.length === 0) return Response.json({ error: "no_mentions" }, { status: 400 });

  const store = getStore();
  const thread = await store.getThread(userId, id);
  if (!thread) return Response.json({ error: "not found" }, { status: 404 });
  if (thread.status === "running") {
    return Response.json({ error: "thread_already_running" }, { status: 409 });
  }

  await store.addThreadMessage(id, {
    author: "human",
    body: message,
    mentions: mentioned.map((a) => a.id),
    hop: 0,
  });

  // hop starts at 1 again: the cap exists to protect an absent operator, and
  // one who is present and typing is not absent.
  const seed: ThreadTurn[] = mentioned.map((a) => ({ agentId: a.id, hop: 1, mode: "discuss" }));
  startLoop(id, seed, thread.repo_path ?? process.cwd(), newBatchId());

  return Response.json({ ok: true }, { status: 201 });
}
```

```ts
// src/app/api/threads/[id]/stop/route.ts
import { currentUserId } from "@/lib/auth";
import { getStore } from "@/lib/ghost";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "bad id" }, { status: 400 });

  const store = getStore();
  if (!(await store.getThread(userId, id))) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  // Takes effect at the next hop boundary; an in-flight CLI process is not
  // killed. The UI says "stopping after this turn" until the status flips.
  await store.setThreadStatus(id, "stopped");
  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/api/threads/[id]/route.test.ts"`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/threads/[id]"
git commit -m "feat(threads): read, reply and stop routes"
```

---

### Task 8: The Threads view

**Files:**
- Create: `src/components/ThreadsView.tsx`
- Modify: `src/components/Sidebar.tsx` (the `WORKSPACE` array)
- Modify: `src/components/MissionControlLayout.tsx` (import + view switch)
- Test: `src/components/ThreadsView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ThreadsView.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ThreadsView from "./ThreadsView";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).endsWith("/api/threads")) {
        return { ok: true, json: async () => ({ threads: [] }) } as Response;
      }
      return { ok: true, json: async () => ({ thread: { id: 1, status: "idle" }, messages: [] }) } as Response;
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("ThreadsView", () => {
  it("names the agents you can address", async () => {
    render(<ThreadsView />);
    await waitFor(() => expect(screen.getByText(/@claude/)).toBeTruthy());
    expect(screen.getByText(/@codex/)).toBeTruthy();
  });

  // The route rejects a mention-less opener; saying so up front beats a 400.
  it("keeps Start disabled until the message mentions an agent", async () => {
    render(<ThreadsView />);
    const box = await screen.findByPlaceholderText(/@claude/i);
    const start = screen.getByRole("button", { name: /start/i });
    fireEvent.change(box, { target: { value: "what do we think?" } });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "@claude what do we think?" } });
    expect((start as HTMLButtonElement).disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ThreadsView.test.tsx`
Expected: FAIL — `Failed to resolve import "./ThreadsView"`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ThreadsView.tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CLI_ROSTER } from "@/lib/roster";

type Thread = { id: number; title: string; status: string };
type Message = { id: number; author: string; body: string; hop: number };

const HANDLES = CLI_ROSTER.map((a) => `@${a.id}`).join(" ");
const MENTION_RE = new RegExp(`@(${CLI_ROSTER.map((a) => a.id).join("|")})\\b`, "i");

function displayName(author: string): string {
  if (author === "human") return "You";
  return CLI_ROSTER.find((a) => a.id === author)?.name ?? author;
}

export default function ThreadsView() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [current, setCurrent] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/threads");
    if (res.ok) setThreads((await res.json()).threads ?? []);
  }, []);

  const loadThread = useCallback(async (id: number) => {
    const res = await fetch(`/api/threads/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setCurrent(data.thread);
    setMessages(data.messages ?? []);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Poll only while a run is in flight. A single turn takes tens of seconds, so
  // 2s is indistinguishable from streaming and an order of magnitude less code.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (current?.status !== "running") return;
    timer.current = setInterval(() => void loadThread(current.id), 2000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [current?.status, current?.id, loadThread]);

  const canSend = MENTION_RE.test(draft) && !busy;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    try {
      const url = current ? `/api/threads/${current.id}/messages` : "/api/threads";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error === "thread_already_running" ? "Another thread is still running." : data.error);
        return;
      }
      setDraft("");
      const id = current?.id ?? data.thread?.id;
      if (id) {
        setCurrent({ id, title: draft.slice(0, 80), status: "running" });
        await loadThread(id);
      }
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!current) return;
    await fetch(`/api/threads/${current.id}/stop`, { method: "POST" });
    await loadThread(current.id);
  }

  return (
    <section className="p-6 space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Threads</h2>
        <p className="text-sm opacity-70">
          Agents read the whole thread and can hand the floor to each other. Address them by handle: {HANDLES}
        </p>
      </header>

      {threads.length > 0 && (
        <select
          className="w-full rounded border p-2 text-sm"
          value={current?.id ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (id) void loadThread(id);
            else {
              setCurrent(null);
              setMessages([]);
            }
          }}
        >
          <option value="">New thread…</option>
          {threads.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}

      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className="rounded border p-3">
            <div className="text-xs uppercase opacity-60">
              {displayName(m.author)}
              {m.hop > 0 && ` · hop ${m.hop}`}
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
          </li>
        ))}
      </ol>

      {current?.status === "running" && (
        <div className="flex items-center gap-3 text-sm">
          <span className="opacity-70">Running…</span>
          <button className="rounded border px-3 py-1" onClick={() => void stop()}>
            Stop after this turn
          </button>
        </div>
      )}

      <textarea
        className="w-full rounded border p-2 text-sm"
        rows={3}
        placeholder={`@claude what do you make of this?`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button className="rounded border px-4 py-2 disabled:opacity-40" disabled={!canSend} onClick={() => void send()}>
        {current ? "Reply" : "Start"}
      </button>
    </section>
  );
}
```

Add the nav entry to the `WORKSPACE` array in `src/components/Sidebar.tsx`,
directly after the `council` line so the two conversation features sit together:

```ts
  { id: "threads", label: "Threads", icon: "☰" },
```

Then render it in `src/components/MissionControlLayout.tsx`, next to the other
view switches (after the `council` line):

```tsx
          {view === "threads" && <ThreadsView />}
```

and add the import at the top of that file, alongside the other view imports:

```tsx
import ThreadsView from "./ThreadsView";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ThreadsView.test.tsx`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/ThreadsView.tsx src/components/ThreadsView.test.tsx \
        src/components/Sidebar.tsx src/components/MissionControlLayout.tsx
git commit -m "feat(threads): threads view"
```

---

### Task 9: Verify it live, then open the PR

Unit tests passing is not evidence the feature works. Every real defect in this repo so far — the empty worktree diff, the graph that never rendered, `npm run db:init` — passed its tests and failed in the product.

- [ ] **Step 1: Full check**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```
Expected: clean, all tests pass, build OK.

- [ ] **Step 2: Run it and hold a real conversation**

```bash
docker compose up -d && npm run start
```

At `http://localhost:3000`, open Threads and confirm each of these:

- A message with no handle leaves **Start** disabled.
- `@claude` plus a real question about the attached repo produces a reply.
- A reply that mentions another agent visibly triggers that agent's turn — this is the whole feature; if the second agent never runs, nothing else matters.
- The second agent's answer refers to the first one's. If it reads like an independent opinion, the transcript is not reaching the prompt.
- **Stop** ends the run at the next turn, and the thread does not return to `idle` afterwards.
- Observability shows a `threads` feature row with per-agent numbers.

- [ ] **Step 3: Check the cap for real**

Start a thread with a prompt designed to keep the ball bouncing, e.g.
`@claude argue with @codex about whether we should add an index, and keep going until one of you concedes`.
Confirm it halts after 5 agent turns.

- [ ] **Step 4: Commit anything the live run exposed, then open the PR**

```bash
git push -u origin feat/agent-threads
```

Then open the PR with a body covering, in this order:

1. What the feature does, in two sentences.
2. **What was verified live** — specifically that a mention triggered a second
   agent and that its answer referred to the first one's. That is the claim the
   whole feature rests on, and unit tests cannot make it.
3. The result of the cap check from Step 3, with the observed number of turns.
4. What is deliberately not included: agents cannot write (block 2), threads do
   not run unattended (block 3).

State only what was actually observed. If a step was skipped, say so.

---

## Spec coverage

| Spec section | Task |
|---|---|
| Data model (`threads`, `thread_messages`, index) | 2 |
| Turn loop, queue, termination | 4 |
| Turn mode as a parameter | 4, 5 |
| Prompt shape | 3 |
| Hard depth cap of 5 | 4 |
| Mentions resolve only to roster ids | 1 |
| One running thread at a time | 6, 7 |
| Agents read-only | 5 |
| Polling, not streaming | 8 |
| Observability via `timedRun` | 5 |
| API: create / list / get / reply / stop | 6, 7 |
| Re-entry resets hop | 7 |
| Status returns to `idle` on natural end | 6 (`threadLoop.ts`) |
| Opening message must mention someone | 6 |
| Threads separate from Council | 8 (new view; Council untouched) |
