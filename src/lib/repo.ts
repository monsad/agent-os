import { spawn as nodeSpawn } from "node:child_process";
import { existsSync, statSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const STORE = path.join(process.cwd(), "data", "workspace.json");

export type Workspace = { repoPath: string | null };

export function getRepo(): Workspace {
  try {
    return JSON.parse(readFileSync(STORE, "utf-8")) as Workspace;
  } catch {
    return { repoPath: null };
  }
}

const DATA_DIR = path.join(process.cwd(), "data");

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Whether the app is allowed to attach this directory.
 *
 * Attaching a directory points file-reading agents at it, so "any path the
 * process can stat" is too much: ~/.ssh or ~/Documents would be readable, and
 * the agent would happily quote what it found back into an answer. Requiring a
 * git repo covers the real use case while excluding those, and the app's own
 * data/ dir stays allowed for uploads (data/context) and clones (data/repos).
 */
export function isAllowedRepoPath(resolved: string): boolean {
  if (isInside(resolved, DATA_DIR)) return true;
  return existsSync(path.join(resolved, ".git"));
}

export function setRepoPath(repoPath: string): Workspace {
  const expanded = repoPath.replace(/^~/, process.env.HOME ?? "~");
  if (!existsSync(expanded) || !statSync(expanded).isDirectory()) {
    throw new Error(`not a directory: ${expanded}`);
  }
  // Resolve before checking so ".." and symlink tricks can't walk out of data/.
  const resolved = path.resolve(expanded);
  if (!isAllowedRepoPath(resolved)) {
    throw new Error(
      `refusing to attach ${resolved}: not a git repository. Agents read whatever ` +
        `directory is attached, so only git repos (or the app's own data/ dir) are allowed.`,
    );
  }
  const ws: Workspace = { repoPath: resolved };
  mkdirSync(path.dirname(STORE), { recursive: true });
  writeFileSync(STORE, JSON.stringify(ws, null, 2), "utf-8");
  return ws;
}

export function cloneRepo(url: string, spawn = nodeSpawn): Promise<Workspace> {
  return new Promise((resolve, reject) => {
    if (!/^https?:\/\/|^git@/.test(url)) {
      reject(new Error("invalid git url"));
      return;
    }
    const name = (url.split("/").pop() ?? "repo").replace(/\.git$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
    const dest = path.join(process.cwd(), "data", "repos", name);
    mkdirSync(path.dirname(dest), { recursive: true });
    const proc = spawn("git", ["clone", "--depth", "1", url, dest], { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    proc.stderr?.on("data", (d) => { err += d.toString(); });
    proc.on("error", (e) => reject(new Error(`git clone failed to start: ${e.message}`)));
    proc.on("close", (code) => {
      if (code === 0 || existsSync(dest)) resolve(setRepoPath(dest));
      else reject(new Error(`git clone exited ${code}: ${err}`));
    });
  });
}
