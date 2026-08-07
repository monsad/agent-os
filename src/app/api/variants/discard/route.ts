import { removeWorktree } from "@/lib/worktree";
import { getBatch, deleteBatch } from "@/lib/variantRuns";

// Tears down every worktree in a batch without applying anything.
export async function POST(request: Request): Promise<Response> {
  let body: { batchId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const { batchId } = body;
  if (!batchId) return Response.json({ error: "batchId required" }, { status: 400 });

  const batch = getBatch(batchId);
  if (!batch) return Response.json({ error: "unknown batch" }, { status: 404 });

  for (const v of batch.variants) {
    if (v.removed) continue;
    try {
      await removeWorktree(batch.repoPath, v.wt);
    } catch { /* best-effort cleanup; stale-worktree sweep will catch stragglers */ }
  }
  deleteBatch(batchId);
  return Response.json({ discarded: batchId });
}
