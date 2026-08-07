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

Single-operator. The login gates *this instance*; it is **not** multi-tenant isolation.
Only goals are scoped per user — conversations, notes, the second brain, the attached
repo and variant runs are global to the instance, so any account that can log in can
read and act on all of them. Do not share an instance between people (see README).

Users register / log in at `/login` (`/api/auth/register` · `login` · `logout`).
Passwords are salted-`scrypt` hashed (`lib/password.ts`, Node-only). On success a
signed session cookie (`<userId>.<issuedAt>.<HMAC-SHA256>`, `lib/auth.ts`) is issued.
`src/middleware.ts` verifies that signature on every page and API route — edge-safe via
Web Crypto, no DB lookup — redirecting browsers to `/login` and returning `401` to APIs.

Enforced in code:

- `AGENT_OS_SESSION_SECRET` is required; there is no fallback, so the app refuses to
  sign or verify rather than accept forgeable sessions.
- The signature covers the issue time, so sessions genuinely expire after 7 days
  instead of relying on the cookie's client-side `Max-Age`.
- Registration closes after the first account (`AGENT_OS_ALLOW_REGISTRATION=true`
  overrides); login is rate limited per client address and per username.
- `/api/repo` accepts only git repositories and the app's own `data/` dir, since
  attaching a directory is what file-reading agents are then pointed at.

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
