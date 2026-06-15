# Agent OS (MVP)

Local Mission Control dashboard: streaming chat (Ollama) + Ghost (Postgres) store +
graphify knowledge-graph memory.

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
