import { applyWorktree, removeWorktree } from "@/lib/worktree";
import { getBatch, deleteBatch } from "@/lib/variantRuns";

// Applies one winning variant's diff onto the main repo, then tears down
// every worktree in the batch — winner included, since its job is done
// once the patch has landed in the real working tree.
export async function POST(request: Request): Promise<Response> {
  let body: { batchId?: string; winnerId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const { batchId, winnerId } = body;
  if (!batchId || !winnerId) return Response.json({ error: "batchId and winnerId required" }, { status: 400 });

  const batch = getBatch(batchId);
  if (!batch) return Response.json({ error: "unknown batch" }, { status: 404 });

  const winner = batch.variants.find((v) => v.id === winnerId);
  if (!winner || !winner.ok) return Response.json({ error: "winner not found or failed" }, { status: 400 });

  try {
    await applyWorktree(batch.repoPath, winner.wt);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "apply failed" }, { status: 409 });
  }

  for (const v of batch.variants) {
    if (v.removed) continue;
    try {
      await removeWorktree(batch.repoPath, v.wt);
    } catch { /* best-effort cleanup; stale-worktree sweep will catch stragglers */ }
  }
  deleteBatch(batchId);
  return Response.json({ applied: winnerId, repo: batch.repoPath });
}
