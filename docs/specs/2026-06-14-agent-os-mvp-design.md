# Agent OS — MVP Design

**Date:** 2026-06-14
**Status:** Approved (brainstorming complete)
**Scope:** Etap 1 (MVP) of a faithful clone of "Hermes Agent OS / Agent OS Profit System"

---

## 1. Goal

Build a faithful, working replica of the Hermes Agent OS "Mission Control" dashboard — a
local-first cockpit that coordinates AI agents around shared memory, goals and context.
Purpose: learning + a usable replica. This document covers **etap 1 (MVP)** only.

The full system is decomposed into sub-projects (each gets its own spec → plan →
implementation). This MVP is sub-project #1.

### Roadmap (full system)

| # | Sub-project | Delivers |
|---|---|---|
| **1** | **MVP: Mission Control + live Ollama chat + Ghost store + graphify memory** | ← this spec |
| 2 | Per-agent Control Rooms | Kanban, skills, plugins, usage analytics (stub → real) |
| 3 | Execution layer (OpenClaw-like) | Task router between agents |
| 4 | Research layer (Hermes-like) | Tool calls, workflows, background research |
| 5 | Full Self layer | Voice input, memory compaction, deeper Obsidian/OMI parity |

---

## 2. Layer mapping (video → our stack)

| Layer (video) | Our implementation |
|---|---|
| Intelligence | **Ollama** (`gpt-oss:20b` via `/v1`) — powers the chat |
| Self / memory (Obsidian + OMI) | **graphify** — knowledge graph built from saved notes/conversations |
| Data / store | **Ghost** (ghost.build) — Postgres-for-agents, via connection string (MCP optional) |
| Execution / Research | Stubbed agents (etaps 3–4) |

> Note: Ghost is a hosted service (account + free tier, auth required), which departs from the
> strict "local-first" framing of the video. Accepted by the user as a deliberate choice.

---

## 3. Tech stack

- **Frontend/app:** Next.js (App Router) + Tailwind CSS
- **Chat model:** Ollama, local, OpenAI-compatible `/v1/chat/completions` (streaming)
- **Structured store:** Ghost (Postgres 16), accessed via connection string from server routes
- **Knowledge graph:** graphify (`graphifyy` Python CLI), invoked as a child process
- **Persistence of notes:** conversation markdown files under `data/notes/` (graphify input)

All secrets (Ollama base URL, Ghost connection string) live server-side in `.env.local`; the
browser never sees them. Ollama and Ghost are reached only from Next.js API routes.

---

## 4. Architecture

```
~/agent-os/                        (new git repo · Next.js App Router + Tailwind)
  src/app/
    page.tsx                       → MissionControlLayout (3 panes)
    api/chat/route.ts              → streaming proxy → Ollama /v1
    api/memory/route.ts            → persist message to Ghost + append .md note
    api/memory/search/route.ts     → graphify query  +  Ghost full-text search
    api/graph/rebuild/route.ts     → spawn `graphify ./data/notes --update`
    api/graph/route.ts             → graph status / serve graph.json
  src/components/
    AgentRail.tsx                  → Local LLM(online) · Ghost(data svc) · Execution/Research(stub)
    ChatWorkspace.tsx
    hooks/useChat.ts
    ContextRail/
      GoalsPanel.tsx               → goals (Ghost)
      JournalPanel.tsx             → auto entries from chats (Ghost)
      GraphExplorer.tsx            → iframe graphify-out/graph.html + query box
    AgentControlRoom.tsx           → tabs (Config/History real, rest scaffolded)
  src/lib/
    ollama.ts                      → chat client (stream)
    ghost.ts                       → pg client (connection string)
    graphify.ts                    → spawn CLI: build / update / query
  data/notes/                      → conversation .md (graphify input)
  graphify-out/                    → graph.html, graph.json (graphify output)
```

### Components (single-purpose units)

- **MissionControlLayout** — 3-pane shell (left/center/right). No logic beyond layout.
- **AgentRail** — list of agents with status dots. Local LLM = online (real); Ghost = data
  service indicator; Execution/Research = greyed stubs. Clicking opens AgentControlRoom.
- **ChatWorkspace** + **useChat** — message list + composer; streams from `/api/chat`.
- **ContextRail** — `GoalsPanel`, `JournalPanel`, `GraphExplorer`.
- **AgentControlRoom** — tabbed panel; for Local LLM, Config + History are real, other tabs
  (Skills/Plugins/Tasks-Kanban/Usage) are scaffolded for etap 2.
- **lib/ollama** — wraps Ollama streaming call.
- **lib/ghost** — pg pool, typed queries for conversations/messages/goals/journal.
- **lib/graphify** — spawns graphify CLI, parses results.

---

## 5. Data flow

1. User sends message → `ChatWorkspace` → `POST /api/chat` (streaming) → **Ollama** → tokens
   stream back into the UI live.
2. On stream completion → `POST /api/memory`: append the exchange to **Ghost** (`messages`
   table) **and** append to `data/notes/<conversation>.md`.
3. `GoalsPanel` / `JournalPanel` read recent rows from **Ghost**.
4. `GraphExplorer` embeds `graphify-out/graph.html` in an iframe. "Rebuild graph" button →
   `POST /api/graph/rebuild` → spawns `graphify ./data/notes --update` → iframe reloads.
   Query box → `POST /api/memory/search` → `graphify query "<q>"` (and Ghost full-text).

### Ghost schema (MVP)

```sql
conversations    (id, title, created_at, updated_at)
messages         (id, conversation_id, role, content, created_at)
goals            (id, title, status, created_at)
journal_entries  (id, conversation_id, summary, created_at)
```

pgvector columns deferred to a later etap.

---

## 6. Error handling (graceful degradation)

Each external dependency fails independently and never takes down the chat:

- **Ollama offline** → banner "Run `ollama serve` (model `gpt-oss:20b`)"; composer disabled,
  no crash.
- **Ghost unreachable** → fall back to local `.md` notes only + a non-blocking warning;
  Goals/Journal panels show "store offline".
- **graphify not installed / no graph yet** → GraphExplorer shows install/build hint instead
  of an empty iframe.
- **Memory write failure** → logged, non-fatal; the chat continues.

---

## 7. Prerequisites

- Node 18+
- Ollama running locally with `gpt-oss:20b` pulled
- Python + `graphifyy` installed (`uv tool install graphifyy` or `pip install graphifyy`)
- Ghost account + CLI (`curl -fsSL https://install.ghost.build | sh`) and a connection
  string set in `.env.local`

---

## 8. Testing

- **Component tests** — layout + panels render with mocked `fetch`.
- **API route tests** — `/api/chat` (mock Ollama stream), `/api/memory` (mock pg + fs),
  `/api/graph/rebuild` (mock `spawn`).
- **Smoke e2e** — boot app, send one message, assert a streamed reply renders and a note is
  written.

---

## 9. Out of scope (MVP)

- Real Execution/Research agents (OpenClaw/Hermes) — stubs only.
- Kanban, skills, plugins, usage analytics — scaffolded tabs only.
- Voice input, pgvector semantic search, multi-agent routing.
- Authentication / multi-user — single local user.
