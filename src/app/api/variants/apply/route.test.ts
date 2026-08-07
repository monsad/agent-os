import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/lib/worktree", () => ({
  applyWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));

import { applyWorktree, removeWorktree } from "@/lib/worktree";
import { POST } from "./route";
import { saveBatch, getBatch, type Variant } from "@/lib/variantRuns";

afterEach(() => vi.restoreAllMocks());

function req(body: unknown): Request {
  return new Request("http://test/api/variants/apply", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function variant(id: string, ok: boolean): Variant {
  return { id, name: id, ok, diff: ok ? "diff --git a/x b/x\n" : "", wt: { path: `/wt/${id}`, branch: `agent-run/${id}`, runId: id }, removed: false };
}

beforeEach(() => {
  saveBatch("b1", "/repos/my-app", [variant("claude", true), variant("codex", true)]);
});

describe("POST /api/variants/apply", () => {
  it("returns 400 when batchId or winnerId is missing", async () => {
    const res = await POST(req({ batchId: "b1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown batch", async () => {
    const res = await POST(req({ batchId: "nope", winnerId: "claude" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when the winner id doesn't exist or failed", async () => {
    saveBatch("b2", "/repos/my-app", [variant("claude", false)]);
    const res = await POST(req({ batchId: "b2", winnerId: "claude" }));
    expect(res.status).toBe(400);
  });

  it("applies the winner and removes every worktree in the batch", async () => {
    (applyWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (removeWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await POST(req({ batchId: "b1", winnerId: "claude" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.applied).toBe("claude");
    expect(applyWorktree).toHaveBeenCalledWith("/repos/my-app", expect.objectContaining({ runId: "claude" }));
    expect(removeWorktree).toHaveBeenCalledTimes(2);
    expect(getBatch("b1")).toBeUndefined();
  });

  it("returns 409 and keeps the batch alive when applying conflicts", async () => {
    (applyWorktree as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("patch does not apply"));

    const res = await POST(req({ batchId: "b1", winnerId: "claude" }));
    expect(res.status).toBe(409);
    expect(getBatch("b1")).toBeDefined();
    expect(removeWorktree).not.toHaveBeenCalled();
  });

  it("skips worktrees already marked removed", async () => {
    saveBatch("b3", "/repos/my-app", [
      { ...variant("claude", true) },
      { ...variant("codex", false), removed: true },
    ]);
    (applyWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (removeWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await POST(req({ batchId: "b3", winnerId: "claude" }));
    expect(removeWorktree).toHaveBeenCalledTimes(1);
  });
});
