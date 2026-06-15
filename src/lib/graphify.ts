import { spawn as nodeSpawn, type SpawnOptions } from "node:child_process";

type SpawnFn = typeof nodeSpawn;

function run(spawn: SpawnFn, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts: SpawnOptions = { cwd: process.cwd() };
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

export async function rebuild(notesDir: string, spawn: SpawnFn = nodeSpawn): Promise<void> {
  await run(spawn, [notesDir, "--update", "--no-viz"]);
  await run(spawn, [notesDir, "--html"]);
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
