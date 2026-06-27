# Agent OS — Product Requirements (PRD)

**Status:** MVP delivered · extended with Architect (M4) and Champion (M5) blocks
**Type:** Custom, local-first developer tool (no public URL by design — see `infrastructure.md`)

## 1. Problem

A developer running several subscription AI agents (Claude, Codex, OpenClaw, local
Ollama models) has no single place to drive them, keep shared context, or get more
than one opinion on a piece of work. Switching between CLIs loses memory, goals, and
history.

## 2. Users

A single operator (the developer) running Agent OS locally as a "Mission Control"
cockpit over their own agents and repositories.

## 3. MVP scope (the working flow)

1. **Live chat** with a local model (Ollama, OpenAI-compatible `/v1`, streaming).
2. **Goals** — full CRUD: create, list, update status, delete (`/api/goals`).
3. **Memory / knowledge graph** — conversations and notes distilled via *graphify*.
4. **Structured store** — Ghost (Postgres) for goals, journal, message search.
5. **Multi-agent fan-out** — one task → many agents (`council` / `delegate` / `review`)
   so the operator always gets a broad opinion, logged for observability.
6. **Repository attach** — point agents at a real repo so they work on shared code.
7. **Access control** — passcode gate at `/login`, enforced by middleware on every
   page and API route.

## 4. Business logic (beyond CRUD)

- Fan-out orchestration with a single `runCliAgent` choke point and per-run timeouts.
- Run log (`lib/runs.ts`) with timed runs and head-to-head batches — observability.
- AI code-review pipeline (`packages/code-reviewer`) that scores a diff on six
  dimensions and posts a verdict on a PR (the Champion block).

## 5. Non-goals (MVP)

- Cloud deployment / public URL (local tool driving local CLIs — intentional).
- Multi-tenant accounts (single operator).
- The later execution/research/voice layers (see `roadmap.md`, sub-projects 3–5).

## 6. Success criteria

- Operator can chat, set/track goals, fan a task out to multiple agents, and read a
  consolidated answer.
- Quality is automated: unit/integration tests run in CI; every PR gets an AI review.
- Access is gated by a passcode before anything is reachable.
