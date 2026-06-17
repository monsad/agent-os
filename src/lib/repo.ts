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

export function setRepoPath(repoPath: string): Workspace {
  const resolved = repoPath.replace(/^~/, process.env.HOME ?? "~");
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw new Error(`not a directory: ${resolved}`);
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
