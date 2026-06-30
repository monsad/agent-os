# Agent OS — Roadmap

Agent OS is decomposed into sub-projects, each with its own spec → plan →
implementation. Status reflects the certification build.

| # | Sub-project | Delivers | Status |
|---|---|---|---|
| **1** | **MVP: Mission Control** | Live Ollama chat, Ghost store, goals CRUD, graphify memory, access gate | ✅ Done |
| 2 | Per-agent Control Rooms | Kanban, skills, plugins, usage analytics | 🟡 Partial (UI + stubs) |
| 3 | Execution layer | Task router / fan-out between agents (council, delegate, review) | ✅ Core done |
| 4 | Research layer | Tool calls, workflows, background research (Hermes-like) | 🟡 Partial |
| 5 | Full Self layer | Voice input, memory compaction, deeper Obsidian/OMI parity | ⬜ Planned |

## Certification overlays (10xDevs 3.0)

| Block | What it added | Where |
|---|---|---|
| **10xBuilder (M1–M3)** | Access control, full goals CRUD, context docs, CI (build+test) | `src/middleware.ts`, `/api/goals`, `docs/`, `.github/workflows/ci.yml` |
| **10xArchitect (M4)** | Repo map, feature research, refactor plan, DDD domain notes, two-pager report | `context/` |
| **10xChampion (M5)** | SDK review agent + CI/CD pipeline that comments on PRs | `packages/code-reviewer`, `.github/workflows/code-review.yml` |

## Near-term

- Wire Control Room analytics to real run-log data (`lib/runs.ts`).
- Promote stubbed research tools (sub-project 4) to live tool calls.
- Optional: extract a shared agent roster (refactor C1 from the Architect report).
