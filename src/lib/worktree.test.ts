import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createWorktree,
  removeWorktree,
  diffWorktree,
  parseWorktreeList,
  listStaleWorktrees,
} from "./worktree";

function fakeSpawn(stdout: string, code = 0) {
  return vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    queueMicrotask(() => {
      proc.stdout.emit("data", Buffer.from(stdout));
      proc.emit("close", code);
    });
    return proc;
  });
}

describe("createWorktree", () => {
  it("adds a worktree on an agent-run/<id> branch under data/worktrees/<repo>", async () => {
    const spawn = fakeSpawn("");
    const wt = await createWorktree("/repos/my-app", "batch1-claude", spawn as never);
    expect(wt.branch).toBe("agent-run/batch1-claude");
    expect(wt.runId).toBe("batch1-claude");
    expect(wt.path).toBe(path.join(process.cwd(), "data", "worktrees", "my-app", "batch1-claude"));
    expect(spawn).toHaveBeenCalledWith(
      "git",
      ["worktree", "add", "-b", "agent-run/batch1-claude", wt.path, "HEAD"],
      expect.objectContaining({ cwd: "/repos/my-app" }),
    );
  });

  it("sanitizes an unsafe runId into a valid branch/path segment", async () => {
    const spawn = fakeSpawn("");
    const wt = await createWorktree("/repos/my-app", "weird id/../with spaces", spawn as never);
    expect(wt.runId).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(wt.branch.startsWith("agent-run/")).toBe(true);
  });

  it("rejects when git exits non-zero", async () => {
    const spawn = fakeSpawn("fatal: already exists", 1);
    await expect(createWorktree("/repos/my-app", "dup", spawn as never)).rejects.toThrow(/git exited 1/);
  });
});

describe("removeWorktree", () => {
  it("removes the worktree then deletes the branch, both from the main repo", async () => {
    const spawn = fakeSpawn("");
    await removeWorktree("/repos/my-app", { path: "/repos/my-app/../wt/x", branch: "agent-run/x", runId: "x" }, spawn as never);
    expect(spawn).toHaveBeenNthCalledWith(
      1,
      "git",
      ["worktree", "remove", "--force", "/repos/my-app/../wt/x"],
      expect.objectContaining({ cwd: "/repos/my-app" }),
    );
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      "git",
      ["branch", "-D", "agent-run/x"],
      expect.objectContaining({ cwd: "/repos/my-app" }),
    );
  });
});

describe("diffWorktree", () => {
  it("runs git diff HEAD inside the worktree path", async () => {
    const spawn = fakeSpawn("diff --git a/x b/x\n+hello\n");
    const out = await diffWorktree({ path: "/wt/x", branch: "agent-run/x", runId: "x" }, spawn as never);
    expect(out).toContain("+hello");
    expect(spawn).toHaveBeenCalledWith("git", ["diff", "HEAD"], expect.objectContaining({ cwd: "/wt/x" }));
  });
});

describe("parseWorktreeList", () => {
  it("parses porcelain output into path/branch pairs", () => {
    const porcelain = [
      "worktree /repos/my-app",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /repos/my-app/../worktrees/my-app/run1",
      "HEAD def456",
      "branch refs/heads/agent-run/run1",
      "",
    ].join("\n");
    expect(parseWorktreeList(porcelain)).toEqual([
      { path: "/repos/my-app", branch: "main" },
      { path: "/repos/my-app/../worktrees/my-app/run1", branch: "agent-run/run1" },
    ]);
  });
});

describe("listStaleWorktrees", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("returns only agent-run worktrees older than maxAgeMs", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "agentos-wt-"));
    const old = path.join(dir, "old-run");
    const fresh = path.join(dir, "fresh-run");
    mkdirSync(old);
    mkdirSync(fresh);
    const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
    utimesSync(old, oldTime, oldTime);

    const porcelain = [
      "worktree /repos/my-app",
      "HEAD abc",
      "branch refs/heads/main",
      "",
      `worktree ${old}`,
      "HEAD def",
      "branch refs/heads/agent-run/old-run",
      "",
      `worktree ${fresh}`,
      "HEAD ghi",
      "branch refs/heads/agent-run/fresh-run",
      "",
    ].join("\n");
    const spawn = fakeSpawn(porcelain);

    const stale = await listStaleWorktrees("/repos/my-app", 24 * 60 * 60 * 1000, spawn as never);
    expect(stale).toHaveLength(1);
    expect(stale[0].runId).toBe("old-run");
    expect(stale[0].ageMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("skips entries whose directory no longer exists on disk", async () => {
    const porcelain = [
      `worktree /nonexistent/agent-run-dir`,
      "HEAD abc",
      "branch refs/heads/agent-run/gone",
      "",
    ].join("\n");
    const spawn = fakeSpawn(porcelain);
    const stale = await listStaleWorktrees("/repos/my-app", 0, spawn as never);
    expect(stale).toHaveLength(0);
  });
});
