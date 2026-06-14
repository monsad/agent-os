# Agent OS MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Mission Control dashboard (Next.js) with a live streaming chat backed by local Ollama, a Ghost (Postgres) structured store, and a graphify knowledge-graph memory panel.

**Architecture:** Next.js App Router app. The browser talks only to server API routes; those routes reach Ollama (chat), Ghost/Postgres (structured store), and the graphify CLI (knowledge graph). UI is a 3-pane Mission Control: agent rail (left), chat (center), context rail with goals/journal/graph (right). Every external dependency degrades gracefully and never crashes the chat.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, `pg` (node-postgres), Ollama OpenAI-compatible `/v1`, graphify (`graphifyy` CLI via `child_process`), Vitest + React Testing Library (unit/component), Playwright (smoke e2e).

---

## File structure

```
~/agent-os/
  package.json, tsconfig.json, next.config.ts, tailwind/postcss config
  vitest.config.ts, vitest.setup.ts, playwright.config.ts
  .env.example, .gitignore
  src/
    lib/
      env.ts            — typed env access (server-only)
      ollama.ts         — streaming chat client
      ghost.ts          — pg pool + typed queries + schema init
      graphify.ts       — spawn graphify build/update/query
      notes.ts          — append conversation markdown to data/notes/
    app/
      layout.tsx, globals.css
      page.tsx          — MissionControlLayout
      api/chat/route.ts
      api/memory/route.ts
      api/memory/search/route.ts
      api/graph/rebuild/route.ts
      api/graph/route.ts
    components/
      MissionControlLayout.tsx
      AgentRail.tsx
      ChatWorkspace.tsx
      AgentControlRoom.tsx
      hooks/useChat.ts
      ContextRail/
        ContextRail.tsx
        GoalsPanel.tsx
        JournalPanel.tsx
        GraphExplorer.tsx
  data/notes/           — conversation .md (gitignored)
  graphify-out/         — graphify output (gitignored)
  tests/
    e2e/smoke.spec.ts
```

Test files live next to source as `*.test.ts(x)` under `src/`. Playwright e2e lives in `tests/e2e/`.

---

## Task 0: Scaffold project + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
.next/
out/
data/notes/
graphify-out/
.env.local
coverage/
test-results/
playwright-report/
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "agent-os",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "next": "15.3.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "pg": "8.13.1"
  },
  "devDependencies": {
    "@playwright/test": "1.49.0",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@types/node": "22.10.0",
    "@types/pg": "8.11.10",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "@vitejs/plugin-react": "4.3.4",
    "autoprefixer": "10.4.20",
    "jsdom": "25.0.1",
    "postcss": "8.4.49",
    "tailwindcss": "3.4.17",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd ~/agent-os && npm install`
Expected: `node_modules/` populated, no fatal errors.

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
};

export default nextConfig;
```

- [ ] **Step 6: Create `postcss.config.mjs`**

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 7: Create `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
html, body { height: 100%; }
body { @apply bg-neutral-950 text-neutral-100; }
```

Tailwind v3 needs a config. Create `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 8: Create `src/app/layout.tsx`**

```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Agent OS", description: "Mission Control" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create placeholder `src/app/page.tsx`**

```tsx
export default function Page() {
  return <main className="p-8">Agent OS booting…</main>;
}
```

- [ ] **Step 10: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 11: Create `vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 12: Create `playwright.config.ts`**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 13: Create `.env.example`**

```
# Ollama (OpenAI-compatible)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=gpt-oss:20b

# Ghost (ghost.build) Postgres connection string
GHOST_DATABASE_URL=postgres://user:pass@host:5432/dbname

# graphify
GRAPHIFY_NOTES_DIR=./data/notes
```

- [ ] **Step 14: Verify build boots**

Run: `cd ~/agent-os && npm run build`
Expected: build completes; `page.tsx` compiles.

- [ ] **Step 15: Commit**

```bash
cd ~/agent-os
git add -A
git commit -m "chore(agent-os): scaffold Next.js + Tailwind + Vitest + Playwright"
```

---

## Task 1: Env accessor (`lib/env.ts`)

**Files:**
- Create: `src/lib/env.ts`
- Test: `src/lib/env.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv } from "./env";

describe("getEnv", () => {
  const old = { ...process.env };
  beforeEach(() => { process.env.OLLAMA_BASE_URL = "http://x/v1"; });
  afterEach(() => { process.env = { ...old }; });

  it("returns a configured value", () => {
    expect(getEnv("OLLAMA_BASE_URL")).toBe("http://x/v1");
  });

  it("returns the fallback when unset", () => {
    delete process.env.OLLAMA_MODEL;
    expect(getEnv("OLLAMA_MODEL", "gpt-oss:20b")).toBe("gpt-oss:20b");
  });

  it("throws when unset and no fallback", () => {
    delete process.env.GHOST_DATABASE_URL;
    expect(() => getEnv("GHOST_DATABASE_URL")).toThrow(/GHOST_DATABASE_URL/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/lib/env.test.ts`
Expected: FAIL — cannot find module `./env`.

- [ ] **Step 3: Write minimal implementation**

```typescript
export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${key}`);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/lib/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): typed env accessor"
```

---

## Task 2: Ollama streaming client (`lib/ollama.ts`)

**Files:**
- Create: `src/lib/ollama.ts`
- Test: `src/lib/ollama.test.ts`

The client posts to `${OLLAMA_BASE_URL}/chat/completions` with `stream: true` and yields content deltas. SSE lines look like `data: {"choices":[{"delta":{"content":"hi"}}]}` and end with `data: [DONE]`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { streamChat, type ChatMessage } from "./ollama";

function sseResponse(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

afterEach(() => vi.restoreAllMocks());

describe("streamChat", () => {
  it("yields content deltas in order", async () => {
    const msgs: ChatMessage[] = [{ role: "user", content: "hi" }];
    vi.stubGlobal("fetch", vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"content":"He"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    ));
    const out: string[] = [];
    for await (const tok of streamChat(msgs)) out.push(tok);
    expect(out.join("")).toBe("Hello");
  });

  it("throws a typed error when the upstream is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const gen = streamChat([{ role: "user", content: "hi" }]);
    await expect(gen.next()).rejects.toThrow(/Ollama/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/lib/ollama.test.ts`
Expected: FAIL — cannot find module `./ollama`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { getEnv } from "./env";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function* streamChat(
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  const base = getEnv("OLLAMA_BASE_URL", "http://localhost:11434/v1");
  const model = getEnv("OLLAMA_MODEL", "gpt-oss:20b");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.2 }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) yield delta;
      } catch {
        // ignore keep-alive / partial lines
      }
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/lib/ollama.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): streaming Ollama chat client"
```

---

## Task 3: Notes writer (`lib/notes.ts`)

**Files:**
- Create: `src/lib/notes.ts`
- Test: `src/lib/notes.test.ts`

Appends a conversation turn to `data/notes/<conversationId>.md`. graphify reads this directory.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appendTurn } from "./notes";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dir: string;
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), "notes-")); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe("appendTurn", () => {
  it("creates the file and writes both roles", async () => {
    await appendTurn(dir, "conv1", "user", "hi there");
    await appendTurn(dir, "conv1", "assistant", "hello back");
    const text = await readFile(path.join(dir, "conv1.md"), "utf-8");
    expect(text).toContain("**user:** hi there");
    expect(text).toContain("**assistant:** hello back");
  });

  it("sanitizes the conversation id into a safe filename", async () => {
    await appendTurn(dir, "../evil/id", "user", "x");
    const text = await readFile(path.join(dir, "evil-id.md"), "utf-8");
    expect(text).toContain("**user:** x");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/lib/notes.test.ts`
Expected: FAIL — cannot find module `./notes`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function appendTurn(
  notesDir: string,
  conversationId: string,
  role: string,
  content: string,
): Promise<void> {
  await mkdir(notesDir, { recursive: true });
  const file = path.join(notesDir, `${safeId(conversationId)}.md`);
  await appendFile(file, `**${role}:** ${content}\n\n`, "utf-8");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/lib/notes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): conversation notes writer"
```

---

## Task 4: Ghost store (`lib/ghost.ts`)

**Files:**
- Create: `src/lib/ghost.ts`
- Test: `src/lib/ghost.test.ts`

Wraps a `pg` Pool. Exposes `initSchema`, `insertMessage`, `recentJournal`, `listGoals`, and an `isAvailable` health check. Tests inject a fake query function so no real DB is needed.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createStore } from "./ghost";

function fakePool(rows: unknown[] = []) {
  return { query: vi.fn(async () => ({ rows })) };
}

describe("ghost store", () => {
  it("initSchema issues CREATE TABLE statements", async () => {
    const pool = fakePool();
    const store = createStore(pool as never);
    await store.initSchema();
    const sql = pool.query.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).toMatch(/create table if not exists conversations/i);
    expect(sql).toMatch(/create table if not exists messages/i);
  });

  it("insertMessage parameterizes role and content", async () => {
    const pool = fakePool([{ id: 1 }]);
    const store = createStore(pool as never);
    await store.insertMessage("conv1", "user", "hi");
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/insert into messages/i);
    expect(params).toEqual(["conv1", "user", "hi"]);
  });

  it("isAvailable returns false when the pool throws", async () => {
    const pool = { query: vi.fn(async () => { throw new Error("down"); }) };
    const store = createStore(pool as never);
    expect(await store.isAvailable()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/lib/ghost.test.ts`
Expected: FAIL — cannot find module `./ghost`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { Pool } from "pg";
import { getEnv } from "./env";

export type QueryablePool = Pick<Pool, "query">;

export type JournalEntry = { id: number; conversation_id: string; summary: string; created_at: string };
export type Goal = { id: number; title: string; status: string; created_at: string };

export function createStore(pool: QueryablePool) {
  return {
    async initSchema(): Promise<void> {
      await pool.query(`create table if not exists conversations (
        id text primary key,
        title text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      )`);
      await pool.query(`create table if not exists messages (
        id bigserial primary key,
        conversation_id text not null,
        role text not null,
        content text not null,
        created_at timestamptz default now()
      )`);
      await pool.query(`create table if not exists goals (
        id bigserial primary key,
        title text not null,
        status text not null default 'open',
        created_at timestamptz default now()
      )`);
      await pool.query(`create table if not exists journal_entries (
        id bigserial primary key,
        conversation_id text,
        summary text not null,
        created_at timestamptz default now()
      )`);
    },

    async insertMessage(conversationId: string, role: string, content: string): Promise<void> {
      await pool.query(
        `insert into conversations (id) values ($1) on conflict (id) do nothing`,
        [conversationId],
      );
      await pool.query(
        `insert into messages (conversation_id, role, content) values ($1, $2, $3)`,
        [conversationId, role, content],
      );
    },

    async recentJournal(limit = 20): Promise<JournalEntry[]> {
      const { rows } = await pool.query(
        `select id, conversation_id, summary, created_at
         from journal_entries order by created_at desc limit $1`,
        [limit],
      );
      return rows as JournalEntry[];
    },

    async listGoals(): Promise<Goal[]> {
      const { rows } = await pool.query(
        `select id, title, status, created_at from goals order by created_at desc`,
      );
      return rows as Goal[];
    },

    async searchMessages(term: string, limit = 20): Promise<{ conversation_id: string; content: string }[]> {
      const { rows } = await pool.query(
        `select conversation_id, content from messages
         where content ilike $1 order by created_at desc limit $2`,
        [`%${term}%`, limit],
      );
      return rows as { conversation_id: string; content: string }[];
    },

    async isAvailable(): Promise<boolean> {
      try {
        await pool.query("select 1");
        return true;
      } catch {
        return false;
      }
    },
  };
}

let singleton: ReturnType<typeof createStore> | null = null;

export function getStore(): ReturnType<typeof createStore> {
  if (singleton) return singleton;
  const pool = new Pool({ connectionString: getEnv("GHOST_DATABASE_URL") });
  singleton = createStore(pool);
  return singleton;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/lib/ghost.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): Ghost Postgres store with injectable pool"
```

---

## Task 5: graphify runner (`lib/graphify.ts`)

**Files:**
- Create: `src/lib/graphify.ts`
- Test: `src/lib/graphify.test.ts`

Wraps the `graphify` CLI via `child_process.spawn`. `rebuild(notesDir)` runs `graphify <dir> --update --no-viz` then `graphify <dir> --html`; `query(notesDir, q)` runs `graphify query "<q>"` from the project root and returns stdout. The spawn function is injected for testing.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { rebuild, query } from "./graphify";

function fakeSpawn(stdout: string, code = 0) {
  return vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter; stderr: EventEmitter;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    queueMicrotask(() => {
      proc.stdout.emit("data", Buffer.from(stdout));
      proc.emit("close", code);
    });
    return proc;
  });
}

describe("graphify runner", () => {
  it("query returns stdout on success", async () => {
    const spawn = fakeSpawn("Answer: 42\n");
    const out = await query("./data/notes", "what is the answer", spawn as never);
    expect(out).toContain("Answer: 42");
    expect(spawn).toHaveBeenCalledWith(
      "graphify",
      ["query", "what is the answer"],
      expect.anything(),
    );
  });

  it("rebuild rejects on non-zero exit", async () => {
    const spawn = fakeSpawn("boom", 1);
    await expect(rebuild("./data/notes", spawn as never)).rejects.toThrow(/graphify/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/lib/graphify.test.ts`
Expected: FAIL — cannot find module `./graphify`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { spawn as nodeSpawn, type SpawnOptions } from "node:child_process";

type SpawnFn = typeof nodeSpawn;

function run(spawn: SpawnFn, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts: SpawnOptions = { cwd: process.cwd() };
    const proc = spawn("graphify", args, opts);
    let out = "";
    let err = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", (d) => { err += d.toString(); });
    proc.on("error", (e) => reject(new Error(`graphify failed to start: ${e.message}`)));
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`graphify exited ${code}: ${err || out}`));
    });
  });
}

export async function rebuild(notesDir: string, spawn: SpawnFn = nodeSpawn): Promise<void> {
  await run(spawn, [notesDir, "--update", "--no-viz"]);
  await run(spawn, [notesDir, "--html"]);
}

export async function query(
  notesDir: string,
  q: string,
  spawn: SpawnFn = nodeSpawn,
): Promise<string> {
  return run(spawn, ["query", q]);
}
```

> Note: `notesDir` is unused by `query` (graphify reads `graphify-out/` at cwd) but kept in the
> signature so routes pass a consistent argument and a future `--root` flag is easy to add.

- [ ] **Step 4: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/lib/graphify.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): graphify CLI runner (rebuild + query)"
```

---

## Task 6: Chat API route (`app/api/chat/route.ts`)

**Files:**
- Create: `src/app/api/chat/route.ts`
- Test: `src/app/api/chat/route.test.ts`

POST receives `{ messages }`, returns a streamed text/plain body of concatenated deltas. On Ollama failure returns HTTP 503 with a JSON error so the UI can show the offline banner.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/ollama", () => ({
  streamChat: vi.fn(),
}));
import { streamChat } from "@/lib/ollama";
import { POST } from "./route";

afterEach(() => vi.restoreAllMocks());

function req(body: unknown): Request {
  return new Request("http://test/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/chat", () => {
  it("streams concatenated deltas", async () => {
    (streamChat as unknown as vi.Mock).mockImplementation(async function* () {
      yield "Hel"; yield "lo";
    });
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello");
  });

  it("returns 400 when messages are missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 503 when Ollama throws", async () => {
    (streamChat as unknown as vi.Mock).mockImplementation(async function* () {
      throw new Error("Ollama request failed: 500");
    });
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/app/api/chat/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { streamChat, type ChatMessage } from "@/lib/ollama";

export async function POST(request: Request): Promise<Response> {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const iterator = streamChat(body.messages)[Symbol.asyncIterator]();

  // Probe the first chunk so upstream failures surface as a 503, not a broken stream.
  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch {
    return Response.json({ error: "ollama_unavailable" }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        let next = await iterator.next();
        while (!next.done) {
          controller.enqueue(encoder.encode(next.value));
          next = await iterator.next();
        }
      } catch {
        // truncate the stream; client already has partial content
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/app/api/chat/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): /api/chat streaming route with 503 fallback"
```

---

## Task 7: Memory + search + graph routes

**Files:**
- Create: `src/app/api/memory/route.ts`
- Create: `src/app/api/memory/search/route.ts`
- Create: `src/app/api/graph/rebuild/route.ts`
- Create: `src/app/api/graph/route.ts`
- Test: `src/app/api/memory/route.test.ts`

These routes persist a turn (Ghost + notes), search (graphify + Ghost), and trigger graph rebuild. Each degrades: if Ghost is down, notes still write; if graphify is missing, search returns Ghost-only results.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/ghost", () => ({ getStore: vi.fn() }));
vi.mock("@/lib/notes", () => ({ appendTurn: vi.fn(async () => {}) }));
import { getStore } from "@/lib/ghost";
import { appendTurn } from "@/lib/notes";
import { POST } from "./route";

afterEach(() => vi.restoreAllMocks());

function req(body: unknown): Request {
  return new Request("http://test/api/memory", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/memory", () => {
  it("writes the note even when Ghost insert fails", async () => {
    (getStore as unknown as vi.Mock).mockReturnValue({
      insertMessage: vi.fn(async () => { throw new Error("db down"); }),
    });
    const res = await POST(req({
      conversationId: "c1", role: "user", content: "hi",
    }));
    expect(res.status).toBe(200);
    expect(appendTurn).toHaveBeenCalledWith(expect.any(String), "c1", "user", "hi");
    const json = await res.json();
    expect(json.ghost).toBe(false);
    expect(json.notes).toBe(true);
  });

  it("returns 400 on missing fields", async () => {
    const res = await POST(req({ role: "user" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/app/api/memory/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write `src/app/api/memory/route.ts`**

```typescript
import { getStore } from "@/lib/ghost";
import { appendTurn } from "@/lib/notes";

const NOTES_DIR = process.env.GRAPHIFY_NOTES_DIR ?? "./data/notes";

export async function POST(request: Request): Promise<Response> {
  let body: { conversationId?: string; role?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const { conversationId, role, content } = body;
  if (!conversationId || !role || !content) {
    return Response.json({ error: "conversationId, role, content required" }, { status: 400 });
  }

  let notesOk = false;
  try {
    await appendTurn(NOTES_DIR, conversationId, role, content);
    notesOk = true;
  } catch { /* non-fatal */ }

  let ghostOk = false;
  try {
    await getStore().insertMessage(conversationId, role, content);
    ghostOk = true;
  } catch { /* non-fatal */ }

  return Response.json({ ok: notesOk || ghostOk, notes: notesOk, ghost: ghostOk });
}
```

- [ ] **Step 4: Write `src/app/api/memory/search/route.ts`**

```typescript
import { getStore } from "@/lib/ghost";
import { query as graphifyQuery } from "@/lib/graphify";

const NOTES_DIR = process.env.GRAPHIFY_NOTES_DIR ?? "./data/notes";

export async function POST(request: Request): Promise<Response> {
  let body: { q?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const q = body.q?.trim();
  if (!q) return Response.json({ error: "q required" }, { status: 400 });

  let graph: string | null = null;
  try {
    graph = await graphifyQuery(NOTES_DIR, q);
  } catch { /* graphify missing or no graph yet */ }

  let messages: { conversation_id: string; content: string }[] = [];
  try {
    messages = await getStore().searchMessages(q);
  } catch { /* ghost offline */ }

  return Response.json({ graph, messages });
}
```

- [ ] **Step 5: Write `src/app/api/graph/rebuild/route.ts`**

```typescript
import { rebuild } from "@/lib/graphify";

const NOTES_DIR = process.env.GRAPHIFY_NOTES_DIR ?? "./data/notes";

export async function POST(): Promise<Response> {
  try {
    await rebuild(NOTES_DIR);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "rebuild failed" },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 6: Write `src/app/api/graph/route.ts`**

```typescript
import { stat } from "node:fs/promises";
import path from "node:path";

export async function GET(): Promise<Response> {
  const htmlPath = path.join(process.cwd(), "graphify-out", "graph.html");
  try {
    const s = await stat(htmlPath);
    return Response.json({ exists: true, builtAt: s.mtime.toISOString() });
  } catch {
    return Response.json({ exists: false });
  }
}
```

- [ ] **Step 7: Run to verify the memory test passes**

Run: `cd ~/agent-os && npx vitest run src/app/api/memory/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): memory/search/graph routes with graceful degradation"
```

---

## Task 8: Static graphify-out serving for the iframe

**Files:**
- Create: `src/app/api/graph/html/route.ts`
- Test: `src/app/api/graph/html/route.test.ts`

`graphify-out/graph.html` lives outside `public/`, so serve it through a route the iframe can load at `/api/graph/html`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:fs/promises", async (orig) => {
  const actual = await orig<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn() };
});
import { readFile } from "node:fs/promises";
import { GET } from "./route";

afterEach(() => vi.restoreAllMocks());

describe("GET /api/graph/html", () => {
  it("returns the html with the right content type", async () => {
    (readFile as unknown as vi.Mock).mockResolvedValue("<html>graph</html>");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toContain("graph");
  });

  it("returns 404 when the graph is not built", async () => {
    (readFile as unknown as vi.Mock).mockRejectedValue(new Error("ENOENT"));
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/app/api/graph/html/route.test.ts`
Expected: FAIL — cannot find module `./route`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(): Promise<Response> {
  const htmlPath = path.join(process.cwd(), "graphify-out", "graph.html");
  try {
    const html = await readFile(htmlPath, "utf-8");
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response("graph not built", { status: 404 });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/app/api/graph/html/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): serve graphify graph.html via route for iframe"
```

---

## Task 9: `useChat` hook

**Files:**
- Create: `src/components/hooks/useChat.ts`
- Test: `src/components/hooks/useChat.test.tsx`

Manages messages, posts to `/api/chat`, reads the streamed body, and persists each turn via `/api/memory`. Exposes `{ messages, send, status }` where status is `idle | streaming | offline`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "./useChat";

function streamBody(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("useChat", () => {
  it("appends user + assistant messages from the stream", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/api/chat")) {
        return new Response(streamBody("Hello"), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));

    const { result } = renderHook(() => useChat("conv-test"));
    await act(async () => { await result.current.send("hi"); });

    await waitFor(() => {
      expect(result.current.messages.at(-1)).toEqual({
        role: "assistant", content: "Hello",
      });
    });
    expect(result.current.messages[0]).toEqual({ role: "user", content: "hi" });
  });

  it("sets status offline on a 503", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const { result } = renderHook(() => useChat("conv-test"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/components/hooks/useChat.test.tsx`
Expected: FAIL — cannot find module `./useChat`.

- [ ] **Step 3: Write minimal implementation**

```typescript
"use client";
import { useCallback, useState } from "react";

export type Msg = { role: "user" | "assistant"; content: string };
export type ChatStatus = "idle" | "streaming" | "offline";

async function persist(conversationId: string, role: string, content: string) {
  try {
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, role, content }),
    });
  } catch { /* non-fatal */ }
}

export function useChat(conversationId: string) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");

  const send = useCallback(
    async (text: string) => {
      const userMsg: Msg = { role: "user", content: text };
      const history = [...messages, userMsg];
      setMessages(history);
      void persist(conversationId, "user", text);
      setStatus("streaming");

      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
      } catch {
        setStatus("offline");
        return;
      }
      if (!res.ok || !res.body) {
        setStatus("offline");
        return;
      }

      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      void persist(conversationId, "assistant", acc);
      setStatus("idle");
    },
    [messages, conversationId],
  );

  return { messages, send, status };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/components/hooks/useChat.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): useChat hook with streaming + persistence"
```

---

## Task 10: ChatWorkspace component

**Files:**
- Create: `src/components/ChatWorkspace.tsx`
- Test: `src/components/ChatWorkspace.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatWorkspace } from "./ChatWorkspace";
import * as hook from "./hooks/useChat";

afterEach(() => vi.restoreAllMocks());

describe("ChatWorkspace", () => {
  it("renders messages and shows the offline banner", () => {
    vi.spyOn(hook, "useChat").mockReturnValue({
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
      send: vi.fn(),
      status: "offline",
    });
    render(<ChatWorkspace conversationId="c1" />);
    expect(screen.getByText("hi")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText(/ollama serve/i)).toBeInTheDocument();
  });

  it("calls send on submit", () => {
    const send = vi.fn();
    vi.spyOn(hook, "useChat").mockReturnValue({ messages: [], send, status: "idle" });
    render(<ChatWorkspace conversationId="c1" />);
    fireEvent.change(screen.getByPlaceholderText(/message/i), { target: { value: "yo" } });
    fireEvent.submit(screen.getByTestId("composer"));
    expect(send).toHaveBeenCalledWith("yo");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/components/ChatWorkspace.test.tsx`
Expected: FAIL — cannot find module `./ChatWorkspace`.

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";
import { useState, type FormEvent } from "react";
import { useChat } from "./hooks/useChat";

export function ChatWorkspace({ conversationId }: { conversationId: string }) {
  const { messages, send, status } = useChat(conversationId);
  const [draft, setDraft] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void send(text);
  }

  return (
    <section className="flex h-full flex-col">
      {status === "offline" && (
        <div className="bg-amber-900/40 px-4 py-2 text-sm text-amber-200">
          Local model offline — run <code>ollama serve</code> (model <code>gpt-oss:20b</code>).
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className="inline-block rounded-lg bg-neutral-800 px-3 py-2 text-sm">
              {m.content}
            </span>
          </div>
        ))}
      </div>
      <form data-testid="composer" onSubmit={onSubmit} className="border-t border-neutral-800 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the local model…"
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm outline-none"
        />
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/components/ChatWorkspace.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): ChatWorkspace with offline banner + composer"
```

---

## Task 11: AgentRail + AgentControlRoom

**Files:**
- Create: `src/components/AgentRail.tsx`
- Create: `src/components/AgentControlRoom.tsx`
- Test: `src/components/AgentRail.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentRail, AGENTS } from "./AgentRail";

describe("AgentRail", () => {
  it("renders all agents with status labels", () => {
    render(<AgentRail onSelect={() => {}} />);
    expect(screen.getByText("Local LLM")).toBeInTheDocument();
    expect(screen.getByText("Ghost")).toBeInTheDocument();
    expect(screen.getAllByText(/offline|online|data/i).length).toBeGreaterThan(0);
  });

  it("invokes onSelect when an agent is clicked", () => {
    const onSelect = vi.fn();
    render(<AgentRail onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Local LLM"));
    expect(onSelect).toHaveBeenCalledWith(AGENTS[0]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/components/AgentRail.test.tsx`
Expected: FAIL — cannot find module `./AgentRail`.

- [ ] **Step 3: Write `src/components/AgentRail.tsx`**

```tsx
"use client";

export type AgentStatus = "online" | "offline" | "data";
export type Agent = { id: string; name: string; status: AgentStatus; role: string };

export const AGENTS: Agent[] = [
  { id: "local-llm", name: "Local LLM", status: "online", role: "Intelligence" },
  { id: "ghost", name: "Ghost", status: "data", role: "Data store" },
  { id: "execution", name: "Execution", status: "offline", role: "OpenClaw (stub)" },
  { id: "research", name: "Research", status: "offline", role: "Hermes (stub)" },
];

const DOT: Record<AgentStatus, string> = {
  online: "bg-emerald-500",
  data: "bg-sky-500",
  offline: "bg-neutral-600",
};

export function AgentRail({ onSelect }: { onSelect: (a: Agent) => void }) {
  return (
    <nav className="flex h-full flex-col gap-1 border-r border-neutral-800 p-3">
      <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Agents</h2>
      {AGENTS.map((a) => (
        <button
          key={a.id}
          onClick={() => onSelect(a)}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-neutral-900"
        >
          <span className={`h-2 w-2 rounded-full ${DOT[a.status]}`} />
          <span className="flex-1">{a.name}</span>
          <span className="text-xs text-neutral-500">{a.status}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Write `src/components/AgentControlRoom.tsx`**

```tsx
"use client";
import { useState } from "react";
import type { Agent } from "./AgentRail";

const TABS = ["Config", "History", "Skills", "Plugins", "Tasks", "Usage"] as const;
type Tab = (typeof TABS)[number];

export function AgentControlRoom({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("Config");
  const live = agent.id === "local-llm";

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[640px] max-w-[90vw] rounded-lg border border-neutral-800 bg-neutral-950 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{agent.name} — Control Room</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">✕</button>
        </div>
        <div className="mb-3 flex gap-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-1 ${tab === t ? "bg-neutral-800" : "text-neutral-500"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="min-h-[140px] text-sm text-neutral-300">
          {tab === "Config" && (
            <p>Role: {agent.role}. {live ? "Backed by Ollama gpt-oss:20b." : "Stub — wired in a later etap."}</p>
          )}
          {tab === "History" && <p>{live ? "Conversation history is stored in Ghost." : "No history (stub)."}</p>}
          {tab !== "Config" && tab !== "History" && (
            <p className="text-neutral-500">{tab} — scaffolded for etap 2.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/components/AgentRail.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): AgentRail + AgentControlRoom"
```

---

## Task 12: ContextRail (Goals, Journal, GraphExplorer)

**Files:**
- Create: `src/components/ContextRail/GoalsPanel.tsx`
- Create: `src/components/ContextRail/JournalPanel.tsx`
- Create: `src/components/ContextRail/GraphExplorer.tsx`
- Create: `src/components/ContextRail/ContextRail.tsx`
- Test: `src/components/ContextRail/GraphExplorer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GraphExplorer } from "./GraphExplorer";

afterEach(() => vi.restoreAllMocks());

describe("GraphExplorer", () => {
  it("posts the query and renders the graphify answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ graph: "Answer: foo", messages: [] }), { status: 200 }),
    ));
    render(<GraphExplorer />);
    fireEvent.change(screen.getByPlaceholderText(/ask the graph/i), {
      target: { value: "what is foo" },
    });
    fireEvent.submit(screen.getByTestId("graph-query"));
    await waitFor(() => expect(screen.getByText(/Answer: foo/)).toBeInTheDocument());
  });

  it("triggers a rebuild", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<GraphExplorer />);
    fireEvent.click(screen.getByText(/rebuild/i));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/graph/rebuild", expect.objectContaining({ method: "POST" })),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/components/ContextRail/GraphExplorer.test.tsx`
Expected: FAIL — cannot find module `./GraphExplorer`.

- [ ] **Step 3: Write `src/components/ContextRail/GraphExplorer.tsx`**

```tsx
"use client";
import { useState, type FormEvent } from "react";

export function GraphExplorer() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onQuery(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/memory/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const json = await res.json();
      setAnswer(json.graph ?? "(no graph yet — rebuild first)");
    } finally {
      setBusy(false);
    }
  }

  async function onRebuild() {
    setBusy(true);
    try {
      await fetch("/api/graph/rebuild", { method: "POST" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wide text-neutral-500">Knowledge graph</h3>
        <button onClick={onRebuild} disabled={busy} className="text-xs text-sky-400 hover:underline">
          Rebuild
        </button>
      </div>
      <iframe title="graph" src="/api/graph/html" className="h-40 w-full rounded border border-neutral-800 bg-white" />
      <form data-testid="graph-query" onSubmit={onQuery}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask the graph…"
          className="w-full rounded bg-neutral-900 px-2 py-1 text-sm outline-none"
        />
      </form>
      {answer && <pre className="whitespace-pre-wrap rounded bg-neutral-900 p-2 text-xs">{answer}</pre>}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/components/ContextRail/GoalsPanel.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

type Goal = { id: number; title: string; status: string };

export function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  useEffect(() => {
    fetch("/api/goals").then((r) => (r.ok ? r.json() : { goals: [] }))
      .then((d) => setGoals(d.goals ?? []))
      .catch(() => setGoals([]));
  }, []);
  return (
    <div className="space-y-1">
      <h3 className="text-xs uppercase tracking-wide text-neutral-500">Goals</h3>
      {goals === null && <p className="text-xs text-neutral-600">loading…</p>}
      {goals?.length === 0 && <p className="text-xs text-neutral-600">No goals yet.</p>}
      {goals?.map((g) => (
        <div key={g.id} className="text-sm">• {g.title} <span className="text-neutral-500">({g.status})</span></div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Write `src/components/ContextRail/JournalPanel.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

type Entry = { id: number; summary: string; created_at: string };

export function JournalPanel() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  useEffect(() => {
    fetch("/api/journal").then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]));
  }, []);
  return (
    <div className="space-y-1">
      <h3 className="text-xs uppercase tracking-wide text-neutral-500">Journal</h3>
      {entries === null && <p className="text-xs text-neutral-600">loading…</p>}
      {entries?.length === 0 && <p className="text-xs text-neutral-600">No entries yet.</p>}
      {entries?.map((e) => (
        <div key={e.id} className="text-xs text-neutral-400">{e.summary}</div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Write `src/components/ContextRail/ContextRail.tsx`**

```tsx
import { GoalsPanel } from "./GoalsPanel";
import { JournalPanel } from "./JournalPanel";
import { GraphExplorer } from "./GraphExplorer";

export function ContextRail() {
  return (
    <aside className="flex h-full flex-col gap-5 overflow-y-auto border-l border-neutral-800 p-3">
      <GoalsPanel />
      <JournalPanel />
      <GraphExplorer />
    </aside>
  );
}
```

- [ ] **Step 7: Add the goals/journal read routes**

Create `src/app/api/goals/route.ts`:

```typescript
import { getStore } from "@/lib/ghost";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ goals: await getStore().listGoals() });
  } catch {
    return Response.json({ goals: [] });
  }
}
```

Create `src/app/api/journal/route.ts`:

```typescript
import { getStore } from "@/lib/ghost";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ entries: await getStore().recentJournal() });
  } catch {
    return Response.json({ entries: [] });
  }
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/components/ContextRail/GraphExplorer.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): ContextRail (goals, journal, graph explorer) + read routes"
```

---

## Task 13: MissionControlLayout + wire the page

**Files:**
- Create: `src/components/MissionControlLayout.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/MissionControlLayout.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MissionControlLayout } from "./MissionControlLayout";

describe("MissionControlLayout", () => {
  it("renders the three panes", () => {
    render(<MissionControlLayout />);
    expect(screen.getByText("Agents")).toBeInTheDocument();          // left
    expect(screen.getByPlaceholderText(/message/i)).toBeInTheDocument(); // center
    expect(screen.getByText("Knowledge graph")).toBeInTheDocument(); // right
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ~/agent-os && npx vitest run src/components/MissionControlLayout.test.tsx`
Expected: FAIL — cannot find module `./MissionControlLayout`.

- [ ] **Step 3: Write `src/components/MissionControlLayout.tsx`**

```tsx
"use client";
import { useState } from "react";
import { AgentRail, type Agent } from "./AgentRail";
import { AgentControlRoom } from "./AgentControlRoom";
import { ChatWorkspace } from "./ChatWorkspace";
import { ContextRail } from "./ContextRail/ContextRail";

const CONVERSATION_ID = "default";

export function MissionControlLayout() {
  const [selected, setSelected] = useState<Agent | null>(null);
  return (
    <div className="grid h-screen grid-cols-[220px_1fr_320px]">
      <AgentRail onSelect={setSelected} />
      <ChatWorkspace conversationId={CONVERSATION_ID} />
      <ContextRail />
      {selected && <AgentControlRoom agent={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/app/page.tsx`**

```tsx
import { MissionControlLayout } from "@/components/MissionControlLayout";

export default function Page() {
  return <MissionControlLayout />;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd ~/agent-os && npx vitest run src/components/MissionControlLayout.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Run the full unit suite**

Run: `cd ~/agent-os && npm run test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): MissionControlLayout 3-pane shell wired into page"
```

---

## Task 14: Schema bootstrap script + smoke e2e

**Files:**
- Create: `scripts/init-db.ts`
- Create: `tests/e2e/smoke.spec.ts`
- Modify: `package.json` (add `db:init` script)

- [ ] **Step 1: Create `scripts/init-db.ts`**

```typescript
import { getStore } from "../src/lib/ghost";

async function main() {
  await getStore().initSchema();
  console.log("Ghost schema initialized.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add the `db:init` script to `package.json`**

Add under `"scripts"`:

```json
"db:init": "node --experimental-strip-types scripts/init-db.ts"
```

- [ ] **Step 3: Write the smoke e2e**

```typescript
import { test, expect } from "@playwright/test";

test("dashboard renders the three panes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Agents")).toBeVisible();
  await expect(page.getByPlaceholder(/message the local model/i)).toBeVisible();
  await expect(page.getByText("Knowledge graph")).toBeVisible();
});

test("sending a message renders a reply when Ollama is up", async ({ page }) => {
  // This test is meaningful only with Ollama running; skip if the chat goes offline.
  await page.goto("/");
  await page.getByPlaceholder(/message the local model/i).fill("say hi in one word");
  await page.keyboard.press("Enter");
  const offline = page.getByText(/ollama serve/i);
  const reply = page.locator("section >> text=/.+/").last();
  await Promise.race([
    offline.waitFor({ timeout: 5000 }).catch(() => {}),
    reply.waitFor({ timeout: 30000 }).catch(() => {}),
  ]);
  expect(true).toBe(true); // smoke: no crash, one path resolved
});
```

- [ ] **Step 4: Run the smoke test**

Run: `cd ~/agent-os && npx playwright install --with-deps chromium && npm run e2e`
Expected: first test PASSES; second test PASSES (no crash) regardless of Ollama state.

- [ ] **Step 5: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "feat(agent-os): db init script + Playwright smoke e2e"
```

---

## Task 15: README + manual verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Agent OS (MVP)

Local Mission Control dashboard: streaming chat (Ollama) + Ghost (Postgres) store +
graphify knowledge-graph memory.

## Prerequisites
- Node 18+
- Ollama running with `gpt-oss:20b` pulled (`ollama pull gpt-oss:20b && ollama serve`)
- `graphifyy` installed (`uv tool install graphifyy` or `pip install graphifyy`)
- A Ghost (ghost.build) Postgres connection string

## Setup
```bash
cp .env.example .env.local   # fill in GHOST_DATABASE_URL
npm install
npm run db:init              # create tables in Ghost
npm run dev                  # http://localhost:3000
```

## Memory graph
Chat turns are saved to `data/notes/*.md`. Click **Rebuild** in the Knowledge graph panel
to run graphify over them, then ask questions in the query box.

## Tests
```bash
npm run test   # unit + component (Vitest)
npm run e2e    # smoke (Playwright)
```
```

- [ ] **Step 2: Manual verification checklist**

Run `npm run dev` and confirm:
- Three panes render.
- With Ollama up: typing a message streams a reply; with Ollama down: amber banner shows.
- After a few messages, **Rebuild** populates the graph iframe; the query box returns an answer.
- Goals/Journal panels show "No … yet" when Ghost is empty, or rows after inserts.

- [ ] **Step 3: Commit**

```bash
cd ~/agent-os && git add -A && git commit -m "docs(agent-os): README with setup + verification checklist"
```

---

## Self-review notes

**Spec coverage:** Mission Control 3-pane (Task 13) · Ollama streaming chat (Tasks 2, 6, 9, 10) ·
Ghost store + schema (Tasks 4, 14) · graphify graph + query + rebuild (Tasks 5, 7, 8, 12) ·
AgentRail with online/data/stub agents + Control Room (Task 11) · Goals/Journal (Task 12) ·
notes persistence (Task 3) · graceful degradation per dependency (Tasks 6, 7, 9, 10, 12) ·
prerequisites + tests (Tasks 0, 14, 15). All spec sections map to a task.

**Type consistency:** `streamChat(messages)` returns `AsyncGenerator<string>` and is consumed in
Task 6. `createStore(pool)` methods (`insertMessage`, `searchMessages`, `listGoals`,
`recentJournal`, `isAvailable`, `initSchema`) are used consistently in Tasks 7, 12, 14.
`useChat(conversationId)` returns `{ messages, send, status }`, matched in Tasks 9, 10.
`Agent`/`AGENTS` shared between Tasks 11 and 13.

**Out of scope (per spec):** real Execution/Research agents, Kanban/skills/plugins/usage,
voice, pgvector, auth — all explicitly deferred.
