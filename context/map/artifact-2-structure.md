# Artifact 2 — Structure (dependency graph)

**Method:** dependency-cruiser (default `--no-config` cruised 0 modules — it needs
TS/tsx resolution config). Import-graph confirmed via direct import analysis,
which is conclusive for a repo this size.

## Top observations
1. **Clean, one-directional layering: UI → HTTP → API routes → `lib`.** Components
   do **not** import `lib` directly (grep for `@/lib/` in `src/components` returns
   nothing except the UI-side `agents.ts` registry). The UI talks to the backend
   only over `fetch` to `/api/*`. That boundary is the project's best structural asset.
2. **No dependency cycles** in the active areas. The layering forbids them.
3. **Two `lib` choke points** concentrate the real logic — see below.

## Layers
| Layer | Where | Depends on |
|---|---|---|
| UI shell + views | `src/components/*` | `agents.ts` (registry), each other; backend via `fetch` |
| HTTP entry points | `src/app/api/*/route.ts` (19 routes) | `src/lib/*` |
| Core engine | `src/lib/*` (9 modules) | node built-ins + Ollama/CLI processes only |

UI entry: `src/app/page.tsx` → `MissionControlLayout` (the view router).

## Choke points (evidence)
| Module | Imported by | Role |
|---|---|---|
| `lib/cliAgent.ts` | council · chat · delegate · review · brain/refine | the single path every CLI agent (claude/codex/opencode/gemini) runs through |
| `lib/runs.ts` | council · chat · delegate · review · observability | telemetry: every agent run is timed + logged here |
| `lib/repo.ts` | council · delegate · review · upload · repo route | the attached-workspace resolver |

These three are the highest-leverage files: a change to `cliAgent.ts` affects
every multi-agent feature at once.

## Entry-point inventory
19 API routes, grouped: chat · council · delegate · review · observability ·
brain(+refine) · graph(+html/rebuild) · memory(+search) · hermes(+kanban/skill) ·
repo · upload · goals · journal.

## Sensitive-to-change areas
- `lib/cliAgent.ts` (fan-in 5) and `lib/runs.ts` (fan-in 5) — touch with care.
- The Sidebar/Layout wiring pair (from artifact 1) — UI-side, high churn.

## Unknowns
- dependency-cruiser not configured for TS yet → no auto-generated graph image.
  (A `.dependency-cruiser.cjs` with a TS resolver would let CI enforce "no cycles".)
