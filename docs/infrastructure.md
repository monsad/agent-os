# Agent OS — Infrastructure

## Stack

- **App:** Next.js (App Router, TypeScript) + Tailwind CSS.
- **Chat model:** Ollama, local, OpenAI-compatible `/v1` (streaming).
- **Agents:** local subscription CLIs invoked from server routes — `claude -p`,
  `codex exec`, `opencode run --dir`, plus local Ollama models. Single choke point:
  `lib/cliAgent.ts` (`runCliAgent`, `RunOpts {cwd, readOnly, write, timeoutMs}`).
- **Structured store:** Ghost (ghost.build) Postgres, via `GHOST_DATABASE_URL`. Optional —
  routes degrade to empty results when unset.
- **Memory:** *graphify* knowledge graph from saved notes/conversations.
- **Code-review agent:** `packages/code-reviewer` — AI SDK `generateObject` + Zod +
  OpenRouter, run from CI.

## Runtime topology

Local-first. The Next.js app runs on the operator's machine and drives local CLIs,
local Ollama, and a hosted Ghost Postgres. There is **no public URL**: the app
orchestrates processes and repositories on the host, so a cloud deploy is out of scope
(documented per the "custom project without public URL" path).

## Access control

Per-user auth. Users register / log in at `/login` (`/api/auth/register` · `login` ·
`logout`). Passwords are salted-`scrypt` hashed (`lib/password.ts`, Node-only). On
success a signed session cookie (`<userId>.<HMAC-SHA256>`, `lib/auth.ts`) is issued.
`src/middleware.ts` verifies that signature on every page and API route — edge-safe via
Web Crypto, no DB lookup — redirecting browsers to `/login` and returning `401` to APIs.
Goals are scoped to the session user, so each user only ever sees their own resources.

## Configuration (`.env`)

| Var | Purpose |
|---|---|
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Local chat model |
| `GHOST_DATABASE_URL` | Postgres store (users, goals, journal) |
| `GRAPHIFY_NOTES_DIR` | Memory notes location |
| `AGENT_OS_SESSION_SECRET` | HMAC key signing session cookies (random secret) |
| `OPENROUTER_API_KEY` | Code-review agent (CI secret) |

## CI/CD

- **`.github/workflows/ci.yml`** — on push/PR to `main`: `npm ci` → `npm test` →
  `npm run build` (type-check + production build). Quality gate.
- **`.github/workflows/code-review.yml`** — on PR: composite action runs the
  `/10x-impl-review` agent over the diff and posts a scorecard comment via `gh pr comment`.

## Testing

- **Unit/integration:** Vitest (`npm test`) — 60 tests across lib, API routes, components.
- **E2E:** Playwright (`npm run e2e`).
- At least one user-perspective test per surface (goals CRUD, chat, sidebar, access gate).

## Repository

Private GitHub repo. For review, add `@przeprogramowani` / `@psmyrdek` /
`@mkczarkowski` as collaborators, or attach structure screenshots (files, tests, CI/CD).
