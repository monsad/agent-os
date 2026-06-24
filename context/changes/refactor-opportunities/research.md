# Refactor opportunities — research (ranking)

Builds on `context/changes/multi-agent-fanout/research.md` and `context/map/repo-map.md`.
Exploration only — **no code changed, no decision made here**. Output is a ranked
proposal for a later planning session.

## Candidates (classified)
| # | Problem (source) | Candidate? (changes code structure) |
|---|---|---|
| C1 | Agent roster duplicated 3× (D1) | **YES** |
| C2 | View wiring = Sidebar array + Layout branch, edited in lockstep (map artifact 1) | **YES** |
| C3 | `timeoutMs: 300_000` magic literal ×3 (D4) | YES (minor) |
| — | Fan-out routes untested (D2) | No — missing test → feasibility input, not a structural fix |
| — | `runs.ts` untested (D3) | No — missing test → feasibility input |

---

## C1 — Shared agent roster
**Lens 1 · current shape (evidence):** three independent arrays —
`COUNCIL` (`api/council/route.ts:5`), `AGENTS` (`api/delegate/route.ts:6`),
`REVIEWERS` (`api/review/route.ts:9`, with a `lens` field). The UI keeps its own
`AGENTS` + `BACKEND_OPTIONS` in `components/agents.ts`. Same agents, four lists.
**Lens 2 · intentionality:** *accidental*, not a load-bearing decision. Git history
(artifact 1) shows the routes were authored feature-by-feature; review's list carries
an extra `lens` field, which is why they drifted apart rather than a deliberate split.
**Lens 3 · migration feasibility:** a **new small abstraction** — `lib/roster.ts`
exporting `FANOUT_AGENTS` (id, name, backend) — consumed by all three routes; review
keeps `lens` as a route-local map keyed by id. Reversible, no data migration. Existing
guard: `cliAgent.test.ts` covers the runners; the routes have no tests, so add a thin
test as the prerequisite. **First step:** create `lib/roster.ts` + point council at it.

## C2 — Data-driven view registry (Sidebar ⇄ Layout)
**Lens 1 · current shape (evidence):** `Sidebar.tsx` holds a `WORKSPACE` array of
`{id,label,icon}`; `MissionControlLayout.tsx` renders `{view === "x" && <XView/>}`
branches. Adding a view = edit **both** (artifact 1: they co-change 6/7 commits).
Mark: evidence.
**Lens 2 · intentionality:** *accidental* — incremental growth; each new tab (council,
delegate, review, observability, brain) repeated the two-edit pattern. No ADR.
**Lens 3 · migration feasibility:** a **new abstraction** — one `VIEWS` registry
`{id,label,icon,component}`; Sidebar maps it for nav, Layout maps it for rendering.
Blast radius is contained to those two files + the registry. Risk: the modal
`AgentControlRoom` and the special `mission-control` landing aren't plain views — they
stay outside the registry. **First step:** define `views.tsx` registry, migrate one
view, confirm parity.

## C3 — Shared fan-out policy constant
**Lens 1 · current shape:** `timeoutMs: 300_000` literal in council/delegate/review.
**Lens 2 · intentionality:** accidental copy-paste after the 120s→300s timeout fix.
**Lens 3 · feasibility:** trivial — `export const FANOUT_TIMEOUT_MS = 300_000` in
`lib/roster.ts` (rides along with C1). No risk.

---

## Refactor opportunities (ranked)
1. **C1 — extract one shared agent roster.** Current → target: 3 (+1 UI) arrays → one
   `lib/roster.ts`. Ranks first: highest debt/risk-of-drift for lowest change cost —
   the Gemini removal already proved the 3× edit tax (real evidence). Blast radius:
   council/delegate/review routes only. Path: add roster → migrate council → delegate →
   review → fold C3 in. Prereq: a thin council route test to lock behaviour.
2. **C2 — data-driven view registry.** Current → target: Sidebar array + Layout branches
   → one `VIEWS` registry. Ranks second: it's the *hottest* coupling (artifact 1) but a
   touch riskier (modal + landing are special cases) and less urgent than C1.
3. *(C3 folds into C1 — not a standalone item.)*

### Considered and rejected
- **D2/D3 (missing tests)** — not structural; they're a *prerequisite* for C1/C2, not a
  refactor. Add them as the first step of whichever candidate ships.

> Ranking is a proposal for a separate planning session, read after this report.
