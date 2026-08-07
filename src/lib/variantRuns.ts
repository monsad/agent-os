import type { Worktree } from "./worktree";

// In-memory batch state for /api/variants — mirrors runs.ts's approach to
// session-scoped state (no DB for something this short-lived). A batch lives
// only from "create variants" through "apply" or "discard".
export type Variant = {
  id: string;
  name: string;
  ok: boolean;
  diff: string;
  error?: string;
  wt: Worktree;
  removed: boolean;
};

export type Batch = { repoPath: string; variants: Variant[] };

const batches = new Map<string, Batch>();

export function saveBatch(batchId: string, repoPath: string, variants: Variant[]): void {
  batches.set(batchId, { repoPath, variants });
}

export function getBatch(batchId: string): Batch | undefined {
  return batches.get(batchId);
}

export function deleteBatch(batchId: string): void {
  batches.delete(batchId);
}
