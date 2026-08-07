import { getRepo } from "@/lib/repo";
import { runCliAgent } from "@/lib/cliAgent";
import { selectAgents } from "@/lib/roster";
import { createWorktree, diffWorktree, removeWorktree } from "@/lib/worktree";
import { timedRun, newBatchId } from "@/lib/runs";
import { saveBatch, type Variant } from "@/lib/variantRuns";
import { readJson, invalidJson } from "@/lib/http";

// Runs a task ×N in isolated git worktrees (one per agent) so write-mode
// agents never collide on the same files, then returns each agent's diff
// for review. Nothing lands in the repo until POST /api/variants/apply.
export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ task?: string; agents?: string[] }>(request);
  if (!body) return invalidJson();
  const task = body.task?.trim();
  if (!task) return Response.json({ error: "task required" }, { status: 400 });

  const repoPath = getRepo().repoPath;
  if (!repoPath) return Response.json({ error: "no_repo" }, { status: 400 });

  const selected = selectAgents(body.agents);
  const batchId = newBatchId();
  const prompt = `Task: ${task}

Implement this directly in the repository. Make focused, minimal changes.
Do not commit — leave your edits uncommitted in the working tree so they can
be reviewed as a diff before anything is applied.`;

  const variants: Variant[] = await Promise.all(
    selected.map(async (a): Promise<Variant> => {
      const wt = await createWorktree(repoPath, `${batchId}-${a.id}`);
      try {
        await timedRun(
          { feature: "variants", agent: a.name, backend: a.backend, task: task.slice(0, 140), repo: repoPath, batchId },
          () => runCliAgent(a.backend, [{ role: "user", content: prompt }], undefined, { cwd: wt.path, write: true, timeoutMs: 600_000 }),
        );
        const diff = await diffWorktree(wt);
        return { id: a.id, name: a.name, ok: true, diff, wt, removed: false };
      } catch (e) {
        // A failed run leaves nothing worth reviewing — clean up its worktree
        // immediately rather than waiting for apply/discard on this batch.
        let removed = false;
        try {
          await removeWorktree(repoPath, wt);
          removed = true;
        } catch { /* best-effort; stale-worktree sweep will catch it later */ }
        return { id: a.id, name: a.name, ok: false, diff: "", error: e instanceof Error ? e.message : "failed", wt, removed };
      }
    }),
  );

  saveBatch(batchId, repoPath, variants);
  return Response.json({
    batchId,
    repo: repoPath,
    variants: variants.map(({ id, name, ok, diff, error }) => ({ id, name, ok, diff, error })),
  });
}
