# Agent OS (MVP)

Local Mission Control dashboard: streaming chat (Ollama) + Ghost (Postgres) store +
graphify knowledge-graph memory.

## Scope: single-operator, localhost

Agent OS is built for one person running it on their own machine. The login screen
locks your own instance; it is **not** multi-tenant isolation. Any account that can
log in can read and act on everything in the instance — conversations, notes, the
attached repo. Only goals are scoped per user.

Do not expose this to the internet or share an instance between people. There is no
rate limiting, no session revocation, and `/api/repo` will point agents at any
directory on the host by design.

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

Set `AGENT_OS_SESSION_SECRET` to a long random string before first run; the built-in
fallback is a publicly known development value and anyone can forge a session with it.

## Prerequisites
- Node 18+
- Ollama running with `gpt-oss:20b` pulled (`ollama pull gpt-oss:20b && ollama serve`)
- `graphifyy` installed (`uv tool install graphifyy` or `pip install graphifyy`)
- A Ghost (ghost.build) Postgres connection string

## Setup
```bash
cp .env.example .env.local   # fill in GHOST_DATABASE_URL
npm install
npm run db:init              # create tables in Ghost
npm run dev                  # http://localhost:3000
```

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
