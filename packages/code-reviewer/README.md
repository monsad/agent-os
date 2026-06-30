# @agent-os/code-reviewer

AI code-review agent: a git diff goes in, a structured `/10x-impl-review` verdict
comes out (AI SDK + OpenRouter + zod).

## Run locally
```bash
export OPENROUTER_API_KEY=sk-or-...
git diff origin/main...HEAD | npm run review        # JSON verdict
git diff origin/main...HEAD | npx tsx src/comment.ts # Markdown comment
```

## In CI
`.github/workflows/code-review.yml` runs this on every PR to `main` and posts the
verdict as a PR comment, via the reusable composite action in
`.github/actions/code-review`.

The agent flags; the human owns the merge.
