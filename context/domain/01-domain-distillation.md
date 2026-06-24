---
title: "Domain distillation — agent-os"
created: 2026-06-24
type: domain-distillation
---

# Domain distillation — agent-os

**Source material:** `docs/specs/2026-06-14-agent-os-mvp-design.md` (vision/spec),
the embedded `house-rules.md` charter (`src/lib/brain.ts`), and the code. No formal
PRD — noted as a limitation; the spec is the closest vision document.

## Step 1 — Ubiquitous language
| Term | Definition | Source (doc) | In code |
|---|---|---|---|
| **Agent** | a named worker backed by a model/CLI | spec:11 ("orchestrates AI agents") | `components/agents.ts` (+ 3 route arrays) |
| **Backend** | how an agent runs: ollama \| claude \| codex \| opencode \| gemini | — | `cliAgent.ts:4` `CliBackend` |
| **Run** | one agent invocation, timed, with a status | — | `runs.ts:9` `RunRecord` |
| **Workspace / repo** | the attached dir agents read | spec (repo attach) | `repo.ts` |
| **Opinion / Proposal / Finding** | a fan-out result (council / delegate / review) | — | the three fan-out routes |
| **Atom / Thread / Briefing / Friction** | second-brain units | house-rules (`brain.ts:19`) | `brain.ts`, `api/brain/*` |
| **Prime Directive** | "no source, no note"; sources are read-only | `brain.ts:19` | declared only (see drift) |
| **Skill / Kanban task** | Hermes capabilities | — | `api/hermes/*` (delegated to Hermes) |

## Step 2 — Subdomains
| Subdomain | Class | Why |
|---|---|---|
| **Multi-agent orchestration** (fan-out → opinion/proposal/finding) + the Agent/Backend model | **Core** | this is the product's edge — "ask once, every agent answers" (spec:11) |
| Observability (Run/telemetry) | Supporting | makes the core trustworthy, not the point itself |
| Second Brain (Atom/Briefing/Friction) | Supporting | valuable, but a distinct compounding feature |
| Knowledge Graph (graphify) | Supporting | |
| Chat · file upload · repo attach | Generic | plumbing |
| Kanban / Skills | Generic | delegated to Hermes, not owned here |

## Step 3 — Aggregate candidates + invariants
| Aggregate | Invariant (must always hold) | Code status |
|---|---|---|
| **Brain / Refinery** | sources (`0-raw/`, `sources/`) are immutable; every atom traces to a real source | **declared, NOT enforced** — `brain.ts:19` states it; `api/brain/refine` runs Claude in write mode (`acceptEdits`) with `cwd=brain`, and nothing in code prevents editing sources |
| **Run** | every run has `status ∈ {ok,fail,timeout}` and a duration | **enforced** — `runs.ts:6,15` via `timedRun` |
| **Fan-out** | council/delegate/review agents run **read-only** | **enforced** — `RunOpts.readOnly` → `--permission-mode plan` / `--sandbox read-only` (`cliAgent.ts:71,79`) |

## Step 4 — Model vs Code drift (the valuable part)
| Doc says | Code does | Evidence |
| --- | --- | --- |
| Ghost (Postgres) is the structured store for goals/journal/conversations | unconfigured → degrades to empty; the store subdomain is largely unrealized | spec:36,48 vs `ghost.ts` `isAvailable()` fallback |
| Sources are READ ONLY; "no source, no note" | enforced **only by the prompt**; the write-mode brain agent can touch anything under `brain/` | `brain.ts:19` (charter) vs `api/brain/refine` + `RunOpts.write` |
| One **Agent** concept | duplicated across 4 lists (3 routes + `agents.ts`) | council/delegate/review + `agents.ts` |

## Step 5 — Refactor ranking (aggregates by value × risk)
1. **Brain aggregate — #1.** Highest value (the Prime Directive is the product's
   *trust* guarantee — a second brain you can't trust is worse than none) × highest
   risk (today only a prompt enforces it; one mis-behaving write-mode run could mutate
   a source). Target shape: a guard that refuses writes outside `2-atoms/3-threads/
   briefings/` and verifies each new atom cites a source — making the invariant real in
   code, not just in prose. (Connects to M4L5 prompt 2 "invariant → guardian aggregate"
   and prompt 3 "anti-corruption layer" around the CLI-agent boundary.)
2. **Run** and **Fan-out read-only** are already enforced — leave them.

## Summary
agent-os's core domain is **multi-agent orchestration** (one task → many agents →
opinions/proposals/findings), with the Agent/Backend pair as its central nouns. The
most important finding is a model-vs-code drift on the **Brain**: its defining
invariant — sources are immutable, every atom is sourced ("Prime Directive") — is
declared in the charter but enforced only by a prompt, while the refiner runs in write
mode. That makes the Brain the #1 aggregate to harden. Two other invariants (Run has a
status; fan-out is read-only) are already enforced in code. The Ghost store remains
mostly unrealized vs the spec, and the **Agent** concept lacks a single representation
(duplicated 4×) — the same C1 debt the refactor analysis ranked first.
