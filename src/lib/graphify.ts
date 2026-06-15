import { spawn as nodeSpawn, type SpawnOptions } from "node:child_process";

type SpawnFn = typeof nodeSpawn;

function run(spawn: SpawnFn, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const opts: SpawnOptions = { cwd: process.cwd() };
    const proc = spawn("graphify", args, opts);
    let out = "";
    let err = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", (d) => { err += d.toString(); });
    proc.on("error", (e) => reject(new Error(`graphify failed to start: ${e.message}`)));
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`graphify exited ${code}: ${err || out}`));
    });
  });
}

export async function rebuild(notesDir: string, spawn: SpawnFn = nodeSpawn): Promise<void> {
  await run(spawn, [notesDir, "--update", "--no-viz"]);
  await run(spawn, [notesDir, "--html"]);
}

export async function query(
  notesDir: string,
  q: string,
  spawn: SpawnFn = nodeSpawn,
): Promise<string> {
  return run(spawn, ["query", q]);
}
