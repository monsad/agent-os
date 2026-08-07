import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/repo", () => ({ getRepo: vi.fn() }));
vi.mock("@/lib/worktree", () => ({
  listStaleWorktrees: vi.fn(),
  removeWorktree: vi.fn(),
}));

import { getRepo } from "@/lib/repo";
import { listStaleWorktrees, removeWorktree } from "@/lib/worktree";
import { sweepStaleWorktrees } from "./instrumentation-node";

afterEach(() => vi.restoreAllMocks());

function wt(id: string) {
  return { path: `/wt/${id}`, branch: `agent-run/${id}`, runId: id, ageMs: 999_999_999 };
}

describe("sweepStaleWorktrees", () => {
  it("does nothing when no repo is attached", async () => {
    (getRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ repoPath: null });
    await sweepStaleWorktrees();
    expect(listStaleWorktrees).not.toHaveBeenCalled();
  });

  it("removes every worktree older than the 24h threshold", async () => {
    (getRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ repoPath: "/repos/my-app" });
    (listStaleWorktrees as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([wt("a"), wt("b")]);
    (removeWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await sweepStaleWorktrees();

    expect(listStaleWorktrees).toHaveBeenCalledWith("/repos/my-app", 24 * 60 * 60 * 1000);
    expect(removeWorktree).toHaveBeenCalledTimes(2);
    expect(removeWorktree).toHaveBeenCalledWith("/repos/my-app", wt("a"));
    expect(removeWorktree).toHaveBeenCalledWith("/repos/my-app", wt("b"));
  });

  it("never throws when listing worktrees fails", async () => {
    (getRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ repoPath: "/repos/my-app" });
    (listStaleWorktrees as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("git not found"));

    await expect(sweepStaleWorktrees()).resolves.toBeUndefined();
    expect(removeWorktree).not.toHaveBeenCalled();
  });

  it("keeps sweeping the rest when one removal fails", async () => {
    (getRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ repoPath: "/repos/my-app" });
    (listStaleWorktrees as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([wt("a"), wt("b")]);
    (removeWorktree as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("locked"));
    (removeWorktree as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    await expect(sweepStaleWorktrees()).resolves.toBeUndefined();
    expect(removeWorktree).toHaveBeenCalledTimes(2);
  });
});
