// Node-only half of the instrumentation hook, split into its own module so
// webpack can tree-shake it out of the edge runtime bundle (instrumentation.ts
// imports this behind a `NEXT_RUNTIME === "nodejs"` string-literal import —
// the exact shape Next.js's build needs to exclude it from edge).
import { getRepo } from "@/lib/repo";
import { listStaleWorktrees, removeWorktree } from "@/lib/worktree";

const STALE_AGE_MS = 24 * 60 * 60 * 1000;

// Reclaims agent-run worktrees left behind by a crash (a run that never hit
// apply/discard). Best-effort throughout: startup must never fail because
// disk cleanup couldn't run.
export async function sweepStaleWorktrees(): Promise<void> {
  const repoPath = getRepo().repoPath;
  if (!repoPath) return;

  let stale: Awaited<ReturnType<typeof listStaleWorktrees>>;
  try {
    stale = await listStaleWorktrees(repoPath, STALE_AGE_MS);
  } catch {
    return;
  }

  for (const wt of stale) {
    try {
      await removeWorktree(repoPath, wt);
    } catch {
      // leave it for the next startup sweep rather than crash boot
    }
  }
}
