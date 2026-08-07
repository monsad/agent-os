import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/repo", () => ({ getRepo: vi.fn() }));
vi.mock("@/lib/cliAgent", () => ({ runCliAgent: vi.fn() }));
vi.mock("@/lib/worktree", () => ({
  createWorktree: vi.fn(),
  diffWorktree: vi.fn(),
  removeWorktree: vi.fn(),
}));
vi.mock("@/lib/runs", () => ({
  timedRun: vi.fn((_meta: unknown, fn: () => Promise<unknown>) => fn()),
  newBatchId: vi.fn(() => "batch1"),
}));

import { getRepo } from "@/lib/repo";
import { runCliAgent } from "@/lib/cliAgent";
import { createWorktree, diffWorktree, removeWorktree } from "@/lib/worktree";
import { POST } from "./route";
import { getBatch } from "@/lib/variantRuns";

afterEach(() => vi.restoreAllMocks());

function req(body: unknown): Request {
  return new Request("http://test/api/variants", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function fakeWt(id: string) {
  return { path: `/wt/${id}`, branch: `agent-run/${id}`, runId: id };
}

describe("POST /api/variants", () => {
  it("returns 400 when task is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no repo is set", async () => {
    (getRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ repoPath: null });
    const res = await POST(req({ task: "do the thing" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_repo");
  });

  it("creates one worktree per selected agent and returns each diff", async () => {
    (getRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ repoPath: "/repos/my-app" });
    (createWorktree as unknown as ReturnType<typeof vi.fn>).mockImplementation((_repo: string, runId: string) =>
      Promise.resolve(fakeWt(runId)),
    );
    (runCliAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("done");
    (diffWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("diff --git a/x b/x\n+hi\n");

    const res = await POST(req({ task: "add a footer", agents: ["claude", "codex"] }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.batchId).toBe("batch1");
    expect(data.variants).toHaveLength(2);
    expect(data.variants.every((v: { ok: boolean }) => v.ok)).toBe(true);
    expect(data.variants[0].diff).toContain("+hi");

    // batch is retrievable for the apply/discard routes
    const batch = getBatch("batch1");
    expect(batch?.variants).toHaveLength(2);
  });

  it("marks a failed agent run ok:false and cleans up its worktree immediately", async () => {
    (getRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ repoPath: "/repos/my-app" });
    (createWorktree as unknown as ReturnType<typeof vi.fn>).mockImplementation((_repo: string, runId: string) =>
      Promise.resolve(fakeWt(runId)),
    );
    (runCliAgent as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("claude exited 1"));
    (removeWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const res = await POST(req({ task: "add a footer", agents: ["claude"] }));
    const data = await res.json();

    expect(data.variants[0].ok).toBe(false);
    expect(data.variants[0].error).toContain("claude exited 1");
    expect(removeWorktree).toHaveBeenCalledWith("/repos/my-app", fakeWt("batch1-claude"));
  });

  it("defaults to all agents when none are specified", async () => {
    (getRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ repoPath: "/repos/my-app" });
    (createWorktree as unknown as ReturnType<typeof vi.fn>).mockImplementation((_repo: string, runId: string) =>
      Promise.resolve(fakeWt(runId)),
    );
    (runCliAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("done");
    (diffWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("");

    const res = await POST(req({ task: "add a footer" }));
    const data = await res.json();
    expect(data.variants).toHaveLength(3);
  });
});
