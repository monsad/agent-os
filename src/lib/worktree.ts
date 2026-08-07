import { spawn as nodeSpawn } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

// Git worktree isolation for parallel agent runs — mirrors lib/cliAgent.ts's
// SpawnFn-injection pattern. Each run gets its own working directory and
// branch so two agents writing to the same repo at once never collide.
type SpawnFn = typeof nodeSpawn;
export type Worktree = { path: string; branch: string; runId: string };
export type StaleWorktree = Worktree & { ageMs: number };

const WORKTREES_ROOT = path.join(process.cwd(), "data", "worktrees");
const BRANCH_PREFIX = "agent-run/";
const DEFAULT_TIMEOUT_MS = 30_000;

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+/, "") || "run";
}

function repoSlug(repoPath: string): string {
  return safeId(path.basename(repoPath));
}

function runProcess(
  spawn: SpawnFn,
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  stdin?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => {
        proc.kill("SIGKILL");
        reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
      });
    }, timeoutMs);

    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", (d) => { err += d.toString(); });
    proc.on("error", (e) => finish(() => reject(new Error(`${cmd} failed to start: ${e.message}`))));
    proc.on("close", (code) =>
      finish(() => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err || out}`)))),
    );

    if (stdin !== undefined) {
      proc.stdin?.write(stdin);
      proc.stdin?.end();
    }
  });
}

// New worktree + branch off HEAD, under data/worktrees/<repo>/<runId> — kept
// inside the app's own data dir, never inside the target repo itself.
export async function createWorktree(
  repoPath: string,
  runId: string,
  spawn: SpawnFn = nodeSpawn,
): Promise<Worktree> {
  const id = safeId(runId);
  const branch = `${BRANCH_PREFIX}${id}`;
  const dest = path.join(WORKTREES_ROOT, repoSlug(repoPath), id);
  mkdirSync(path.dirname(dest), { recursive: true });
  await runProcess(spawn, "git", ["worktree", "add", "-b", branch, dest, "HEAD"], repoPath);
  return { path: dest, branch, runId: id };
}

// Must run from the main repo (repoPath), not the worktree — the worktree
// directory no longer exists once `git worktree remove` returns.
export async function removeWorktree(
  repoPath: string,
  wt: Worktree,
  spawn: SpawnFn = nodeSpawn,
): Promise<void> {
  await runProcess(spawn, "git", ["worktree", "remove", "--force", wt.path], repoPath);
  await runProcess(spawn, "git", ["branch", "-D", wt.branch], repoPath);
}

export async function diffWorktree(wt: Worktree, spawn: SpawnFn = nodeSpawn): Promise<string> {
  return runProcess(spawn, "git", ["diff", "HEAD"], wt.path);
}

// Agent edits in a worktree are typically uncommitted (acceptEdits just writes
// files), so they aren't reachable via `git checkout <branch>` — we take the
// diff and apply it as a patch onto the main repo's working tree instead.
export async function applyWorktree(repoPath: string, wt: Worktree, spawn: SpawnFn = nodeSpawn): Promise<void> {
  const diff = await diffWorktree(wt, spawn);
  if (!diff.trim()) throw new Error("worktree has no changes to apply");
  await runProcess(spawn, "git", ["apply"], repoPath, DEFAULT_TIMEOUT_MS, diff);
}

export function parseWorktreeList(porcelain: string): { path: string; branch: string }[] {
  const entries: { path: string; branch: string }[] = [];
  let cur: { path?: string; branch?: string } = {};
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (cur.path && cur.branch) entries.push({ path: cur.path, branch: cur.branch });
      cur = { path: line.slice("worktree ".length) };
    } else if (line.startsWith("branch ")) {
      cur.branch = line.slice("branch ".length).replace("refs/heads/", "");
    }
  }
  if (cur.path && cur.branch) entries.push({ path: cur.path, branch: cur.branch });
  return entries;
}

// Agent-run worktrees older than maxAgeMs (directory mtime as a proxy for
// "last touched") — for a startup sweep that reclaims disk after a crash.
// Only agent-run/* branches are considered; the main worktree is never listed.
export async function listStaleWorktrees(
  repoPath: string,
  maxAgeMs: number,
  spawn: SpawnFn = nodeSpawn,
): Promise<StaleWorktree[]> {
  const out = await runProcess(spawn, "git", ["worktree", "list", "--porcelain"], repoPath);
  const now = Date.now();
  const stale: StaleWorktree[] = [];
  for (const e of parseWorktreeList(out)) {
    if (!e.branch.startsWith(BRANCH_PREFIX)) continue;
    if (!existsSync(e.path)) continue;
    const ageMs = now - statSync(e.path).mtimeMs;
    if (ageMs >= maxAgeMs) {
      stale.push({ path: e.path, branch: e.branch, runId: e.branch.slice(BRANCH_PREFIX.length), ageMs });
    }
  }
  return stale;
}
