import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/lib/worktree", () => ({ removeWorktree: vi.fn() }));

import { removeWorktree } from "@/lib/worktree";
import { POST } from "./route";
import { saveBatch, getBatch, type Variant } from "@/lib/variantRuns";

afterEach(() => vi.restoreAllMocks());

function req(body: unknown): Request {
  return new Request("http://test/api/variants/discard", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function variant(id: string, removed = false): Variant {
  return { id, name: id, ok: true, diff: "diff", wt: { path: `/wt/${id}`, branch: `agent-run/${id}`, runId: id }, removed };
}

beforeEach(() => {
  saveBatch("d1", "/repos/my-app", [variant("claude"), variant("codex")]);
});

describe("POST /api/variants/discard", () => {
  it("returns 400 when batchId is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown batch", async () => {
    const res = await POST(req({ batchId: "nope" }));
    expect(res.status).toBe(404);
  });

  it("removes every worktree in the batch and clears it", async () => {
    (removeWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await POST(req({ batchId: "d1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.discarded).toBe("d1");
    expect(removeWorktree).toHaveBeenCalledTimes(2);
    expect(getBatch("d1")).toBeUndefined();
  });

  it("skips already-removed worktrees and tolerates removal errors", async () => {
    saveBatch("d2", "/repos/my-app", [variant("claude", true), variant("codex")]);
    (removeWorktree as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("already gone"));

    const res = await POST(req({ batchId: "d2" }));
    expect(res.status).toBe(200);
    expect(removeWorktree).toHaveBeenCalledTimes(1);
    expect(getBatch("d2")).toBeUndefined();
  });
});
