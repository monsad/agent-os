# Agent OS (MVP)

Local Mission Control dashboard: streaming chat (Ollama) + Ghost (Postgres) store +
graphify knowledge-graph memory.

## Scope: single-operator, localhost

Agent OS is built for one person running it on their own machine. The login screen
locks your own instance; it is **not** multi-tenant isolation. Any account that can
log in can read and act on everything in the instance — conversations, notes, the
attached repo. Only goals are scoped per user.

Do not expose this to the internet or share an instance between people.

What the app does enforce:

- **`AGENT_OS_SESSION_SECRET` is required.** There is no fallback — a shipped
  default would be a publicly known signing key. Without it the app refuses to
  sign or verify sessions rather than accepting forgeable ones.
- **Registration closes after the first account.** `/login` doubles as first-run
  setup; once an operator exists, sign-up is refused unless you set
  `AGENT_OS_ALLOW_REGISTRATION=true`.
- **Login is rate limited** — per client address *and* per username, so neither
  spraying one account from many addresses nor many accounts from one address
  gets unlimited guesses.
- **Sessions expire after 7 days**, enforced server-side: the timestamp is inside
  the signature, so a stolen cookie can't outlive it. There is still no
  revocation list — changing `AGENT_OS_SESSION_SECRET` invalidates everything.
- **Only git repositories can be attached** via `/api/repo` (plus the app's own
  `data/` dir). Agents read whatever directory is attached, so pointing it at
  `~/.ssh` or `~/Documents` is refused.

## Bring your own credentials

Nothing here is resold, proxied, or phoned home:

| What | How it authenticates |
|---|---|
| Claude Code, Codex, OpenClaw | **Your existing CLI subscription** — no API key |
| Local models (chat, graph) | **Your Ollama**, on your machine |
| Voice (Whisper, Piper) | **Local model files** — no service, no key |
| Code review *(optional)* | **Your** `OPENROUTER_API_KEY`, read from `.env` |
| Store *(optional)* | **Your** Postgres via `GHOST_DATABASE_URL` |

Swap any of them for your own endpoint or model — every one is an env var. Keys stay
in `.env` (gitignored) and go only to the provider you picked.

Generate `AGENT_OS_SESSION_SECRET` before first run — `openssl rand -hex 32`. The app
will not start a session without it.

## Prerequisites
- Node 18+
- Docker (for the Postgres store — or bring your own Postgres and skip it)
- Ollama running with a model pulled (`ollama pull qwen2.5:14b && ollama serve`)
- `graphify` installed (`uv tool install graphify` or `pip install graphify`)
- Whichever agent CLIs you want to use, already logged in: `claude`, `codex`, `opencode`

## Setup

```bash
cp .env.example .env.local
docker compose up -d          # Postgres on :5439, schema created automatically
npm install
npm run dev                   # http://localhost:3000
```

Then edit `.env.local`:

```bash
GHOST_DATABASE_URL=postgres://postgres:agentos@localhost:5439/agentos
AGENT_OS_SESSION_SECRET=<long random string>
GRAPHIFY_NOTES_DIR=/absolute/path/outside/this/repo
```

Only the database is containerised. The app runs on the host on purpose — it
drives your local agent CLIs under your own logins, your Ollama, and your git
repos. Those are host binaries and host credentials, so a Linux container
can't run them.

To reset the store completely: `docker compose down -v` (drops the volume).

## Memory graph
Chat turns are saved to `data/notes/*.md`. Click **Rebuild** in the Knowledge graph panel
to run graphify over them, then ask questions in the query box.

## Tests
```bash
npm run test   # unit + component (Vitest)
npm run e2e    # smoke (Playwright)
```

## Manual verification checklist
Run `npm run dev` and confirm:
- Three panes render.
- With Ollama up: typing a message streams a reply; with Ollama down: amber banner shows.
- After a few messages, **Rebuild** populates the graph iframe; the query box returns an answer.
- Goals/Journal panels show "No … yet" when Ghost is empty, or rows after inserts.
