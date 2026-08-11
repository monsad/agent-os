import { spawn as nodeSpawn, type SpawnOptions } from "node:child_process";
import path from "node:path";
import { spawnEnv } from "./spawnEnv";

type SpawnFn = typeof nodeSpawn;

function run(spawn: SpawnFn, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts: SpawnOptions = { cwd: process.cwd(), env: spawnEnv() };
    const proc = spawn("graphify", args, opts);
    let out = "";
    let err = "";
    let settled = false;
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", (d) => { err += d.toString(); });
    proc.on("error", (e) => {
      if (settled) return;
      settled = true;
      reject(new Error(`graphify failed to start: ${e.message}`));
    });
    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) resolve(out);
      else reject(new Error(`graphify exited ${code}: ${err || out}`));
    });
  });
}

// graphify needs an LLM to extract entities; default to local Ollama so the
// graph builds with no API key (override via GRAPHIFY_BACKEND / GRAPHIFY_MODEL).
const BACKEND = process.env.GRAPHIFY_BACKEND ?? "ollama";
const MODEL = process.env.GRAPHIFY_MODEL ?? "qwen2.5:14b";
const llmArgs = ["--backend", BACKEND, "--model", MODEL, "--max-concurrency", "1"];

// graphify-out/ is written next to the notes, not at cwd — everything that
// reads the built graph must go through this.
export function graphOutDir(notesDir: string): string {
  return path.join(path.resolve(notesDir), "graphify-out");
}

export function graphHtmlPath(notesDir: string): string {
  return path.join(graphOutDir(notesDir), "graph.html");
}

// Two passes, both required: `--update` extracts entities into graph.json, then
// `cluster-only` names the communities and renders graph.html. There is no
// `--html` flag (only `--no-viz` to opt out of the render), so the previous
// version suppressed the visualisation on pass 1 and then hung forever on an
// unknown flag on pass 2 — graph.html never appeared and the request timed out.
export async function rebuild(notesDir: string, spawn: SpawnFn = nodeSpawn): Promise<void> {
  await run(spawn, [notesDir, "--update", ...llmArgs]);
  await run(spawn, ["cluster-only", notesDir, "--backend", BACKEND, "--model", MODEL]);
}

// notesDir is accepted for a consistent call signature with rebuild() and a future
// `--root` flag; graphify query reads graphify-out/ at cwd, so it is unused today.
export async function query(
  _notesDir: string,
  q: string,
  spawn: SpawnFn = nodeSpawn,
): Promise<string> {
  return run(spawn, ["query", q]);
}
