import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorktree, removeWorktree, diffWorktree, applyWorktree, listStaleWorktrees } from "./worktree";

// Real git, real filesystem — worktree has too many sharp edges (branch name
// collisions, lock files, "already checked out" errors) to trust to mocks alone.
function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

function initRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "agentos-wt-repo-"));
  git(["init", "-q"], dir);
  git(["config", "user.email", "test@test.local"], dir);
  git(["config", "user.name", "Test"], dir);
  writeFileSync(path.join(dir, "README.md"), "hello\n");
  git(["add", "."], dir);
  git(["commit", "-q", "-m", "init"], dir);
  return dir;
}

describe("worktree — real git integration", () => {
  let repo: string | undefined;

  afterEach(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
    repo = undefined;
    rmSync(path.join(process.cwd(), "data", "worktrees"), { recursive: true, force: true });
  });

  it("creates an isolated worktree where writes never touch the main repo", async () => {
    repo = initRepo();
    const wt = await createWorktree(repo, "it-run-1");

    writeFileSync(path.join(wt.path, "new-file.txt"), "from the agent\n");
    git(["add", "."], wt.path);
    git(["commit", "-q", "-m", "agent change"], wt.path);

    // main repo is untouched
    const mainLog = git(["log", "--oneline"], repo);
    expect(mainLog.trim().split("\n")).toHaveLength(1);

    // worktree has the new commit
    const wtLog = git(["log", "--oneline"], wt.path);
    expect(wtLog.trim().split("\n")).toHaveLength(2);
  });

  it("diffWorktree reports uncommitted changes made only in the worktree", async () => {
    repo = initRepo();
    const wt = await createWorktree(repo, "it-run-2");
    writeFileSync(path.join(wt.path, "README.md"), "hello\nedited by agent\n");

    const diff = await diffWorktree(wt);
    expect(diff).toContain("edited by agent");

    const mainDiff = git(["diff", "HEAD"], repo);
    expect(mainDiff).toBe("");
  });

  it("diffWorktree includes a brand-new (untracked) file, not just edits to tracked ones", async () => {
    repo = initRepo();
    const wt = await createWorktree(repo, "it-run-new-file");
    writeFileSync(path.join(wt.path, "NOTES.md"), "a fact worth keeping\n");

    const diff = await diffWorktree(wt);
    expect(diff).toContain("NOTES.md");
    expect(diff).toContain("a fact worth keeping");
  });

  it("applyWorktree creates a brand-new file in the main repo, not just edits", async () => {
    repo = initRepo();
    const wt = await createWorktree(repo, "it-run-apply-new-file");
    writeFileSync(path.join(wt.path, "NOTES.md"), "a fact worth keeping\n");

    await applyWorktree(repo, wt);

    expect(readFileSync(path.join(repo, "NOTES.md"), "utf-8")).toBe("a fact worth keeping\n");
  });

  it("applyWorktree replays uncommitted worktree edits onto the main repo", async () => {
    repo = initRepo();
    const wt = await createWorktree(repo, "it-run-apply");
    writeFileSync(path.join(wt.path, "README.md"), "hello\nagent applied this\n");

    await applyWorktree(repo, wt);

    const applied = git(["diff", "HEAD"], repo);
    expect(applied).toContain("agent applied this");
    // the worktree's own copy is untouched by applying it elsewhere
    const wtDiff = git(["diff", "HEAD"], wt.path);
    expect(wtDiff).toContain("agent applied this");
  });

  it("applyWorktree rejects when the main repo has a conflicting local change", async () => {
    repo = initRepo();
    const wt = await createWorktree(repo, "it-run-apply-conflict");
    writeFileSync(path.join(wt.path, "README.md"), "hello\nfrom the agent\n");
    writeFileSync(path.join(repo, "README.md"), "hello\nfrom the human, first\n");

    await expect(applyWorktree(repo, wt)).rejects.toThrow();
  });

  it("removeWorktree cleans up the directory and the branch", async () => {
    repo = initRepo();
    const wt = await createWorktree(repo, "it-run-3");
    await removeWorktree(repo, wt);

    const branches = git(["branch", "--list", wt.branch], repo);
    expect(branches.trim()).toBe("");

    const list = git(["worktree", "list"], repo);
    expect(list).not.toContain(wt.path);
  });

  it("two concurrent worktrees on the same repo don't collide", async () => {
    repo = initRepo();
    const [a, b] = await Promise.all([
      createWorktree(repo, "it-run-a"),
      createWorktree(repo, "it-run-b"),
    ]);
    expect(a.path).not.toBe(b.path);

    writeFileSync(path.join(a.path, "a.txt"), "from a\n");
    writeFileSync(path.join(b.path, "b.txt"), "from b\n");
    git(["add", "."], a.path);
    git(["commit", "-q", "-m", "a"], a.path);
    git(["add", "."], b.path);
    git(["commit", "-q", "-m", "b"], b.path);

    expect(git(["log", "--oneline"], a.path).trim().split("\n")).toHaveLength(2);
    expect(git(["log", "--oneline"], b.path).trim().split("\n")).toHaveLength(2);
  });

  it("listStaleWorktrees finds a real worktree via git worktree list --porcelain", async () => {
    repo = initRepo();
    const wt = await createWorktree(repo, "it-run-stale");
    const stale = await listStaleWorktrees(repo, 0);
    expect(stale.some((s) => s.path === wt.path)).toBe(true);
  });
});
