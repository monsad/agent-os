# Artifact 1 — Territory (git history)

**Repo:** agent-os · **Range:** 2026-06-14 → 2026-06-22 (40 commits, 8 days, 1 author)

> Evidence note: history is short and single-author, so *territorial* and
> *contributor* signals are weak by design. The structural artifact (2) carries
> most of the map. Hot-spots below are still meaningful — they show where the
> code actually churns as features land.

## Where work actually happens (TOP folders, by changes)
| Area | Changes |
|---|---|
| `src/components` | 63 |
| `src/app` (routes + shell) | 39 |
| `src/lib` (engine) | 31 |

The split mirrors the architecture: **UI (components) ≫ API routes ≫ core libs**.

## Hottest files
| File | Changes | Role |
|---|---|---|
| `src/components/Sidebar.tsx` | 7 | navigation / view switch |
| `src/components/MissionControlLayout.tsx` | 7 | top-level view router |
| `src/components/ChatWorkspace.tsx` | 7 | chat UI + model picker |
| `src/lib/cliAgent.ts` | 6 | runs every CLI agent (claude/codex/opencode/gemini) |
| `src/components/agents.ts` | 6 | agent + backend registry |
| `src/components/AgentControlRoom.tsx` | 6 | per-agent modal |

## Co-change (coupling)
`Sidebar.tsx` changes **6 of 7 times together with `MissionControlLayout.tsx`** — a
tightly-coupled **wiring pair**: adding any view (Council, Delegate, Review,
Observability, Night Shift) requires editing *both* (a nav entry + a render branch).
Secondary co-changes: `cliAgent.ts`, `AgentControlRoom.tsx`, the fan-out routes.

## Common denominators (whole-repo files)
- `src/components/agents.ts` — the registry every agent/feature reads (backends, options).
- `src/lib/cliAgent.ts` — the single choke point all CLI agents flow through.

## Reading
The repo grew **feature-by-feature**: each new capability adds a `*View.tsx` +
an `/api/<feature>/route.ts` + two edits to the Sidebar/Layout wiring pair.
That wiring pair is the highest-friction, highest-value spot to understand —
and the obvious target for the refactor artifact (4).

## Unknowns
- No history depth → can't see "frozen" vs "legacy" areas (everything is new).
- Single author → no contributor ownership signal (artifact 3 will be thin).
