# Agent OS — Test Plan

Tests target **specific risks**, not coverage for its own sake. Each risk below maps
to the test(s) that address it. Run with `npm test` (Vitest) — gated in CI (`ci.yml`).

| ID | Risk | Why it matters | Mitigation | Test(s) |
|----|------|----------------|------------|---------|
| **R1** | **Access-control bypass** — an unauthenticated caller reads or mutates data | Leaks/destroys user data | Middleware gate + every `/api/goals` handler checks `currentUserId` | `src/app/api/goals/route.test.ts` → "rejects an unauthenticated request"; `src/lib/auth.test.ts` → "rejects a missing, malformed or tampered cookie", "verification is secret-dependent" |
| **R2** | **Tenant isolation** — user A reads or deletes user B's goals | Cross-account data breach | Every goal query is scoped by `user_id` (`where ... and user_id = $n`) | `src/app/api/goals/route.test.ts` → "DELETE returns 404 when the goal is not the caller's"; `src/lib/ghost.test.ts` → "updateGoal is scoped to the owner", "deleteGoal only removes the caller's goal" |
| **R3** | **Credential safety** — passwords stored/compared insecurely | Account takeover | Salted `scrypt` hash + `timingSafeEqual` | `src/lib/password.test.ts` |
| **R4** | **Priority misclassification** — the business-logic suggestion is wrong | Feature gives bad guidance, user distrust | Deterministic `suggestPriority` (deadline dominates, then keywords) | `src/lib/priority.test.ts` |
| **R5** | **SQL injection** — untrusted input interpolated into SQL | DB compromise | All queries use bound parameters, never string interpolation | `src/lib/ghost.test.ts` → "searchMessages passes the ILIKE term as a bound parameter", "addGoal binds the owner, title and priority" |

## How to run
```bash
npm test          # all Vitest suites (unit + API route + lib)
npm run e2e       # Playwright end-to-end
```

## Out of scope (stated, not hidden)
- Load/perf testing and full E2E browser coverage are not part of this plan.
- The access gate assumes a single trusted deployment (local Mission Control); it is
  not hardened for hostile multi-tenant hosting.
