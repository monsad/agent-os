import { spawn as nodeSpawn } from "node:child_process";

type SpawnFn = typeof nodeSpawn;
export type CliBackend = "claude" | "codex" | "opencode" | "gemini";
type Msg = { role: string; content: string };
export type RunOpts = { cwd?: string; readOnly?: boolean; write?: boolean; timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 120_000;

function runProcess(
  spawn: SpawnFn,
  cmd: string,
  args: string[],
  cwd: string = process.cwd(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // stdin = "ignore" gives the child an immediate EOF; otherwise CLIs like
    // codex block forever waiting for piped input that never arrives.
    const proc = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
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
  });
}

// Flatten the conversation into a single prompt the stateless CLIs can answer.
export function buildPrompt(messages: Msg[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n") + "\nassistant:";
}

// codex exec frames its answer between a "codex" marker line and a "tokens used" line.
export function extractCodexAnswer(stdout: string): string {
  const lines = stdout.split("\n");
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === "codex") { start = i + 1; break; }
  }
  if (start === -1) return stdout.trim();
  const collected: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (/^tokens used/i.test(lines[i].trim())) break;
    collected.push(lines[i]);
  }
  return collected.join("\n").trim();
}

export async function runClaude(messages: Msg[], spawn: SpawnFn = nodeSpawn, opts: RunOpts = {}): Promise<string> {
  const args = ["-p", buildPrompt(messages), "--output-format", "text"];
  if (opts.readOnly) args.push("--permission-mode", "plan");
  else if (opts.write) args.push("--permission-mode", "acceptEdits");
  const out = await runProcess(spawn, "claude", args, opts.cwd, opts.timeoutMs ?? (opts.write ? 600_000 : undefined));
  return out.trim();
}

export async function runCodex(messages: Msg[], spawn: SpawnFn = nodeSpawn, opts: RunOpts = {}): Promise<string> {
  const args = ["exec", "--skip-git-repo-check", "--color", "never"];
  if (opts.readOnly) args.push("--sandbox", "read-only");
  args.push(buildPrompt(messages));
  const out = await runProcess(spawn, "codex", args, opts.cwd, opts.timeoutMs);
  return extractCodexAnswer(out);
}

// opencode prints a one-time build banner (bun download URL, "> build · <name>")
// before the assistant answer; strip ANSI + banner lines and keep the rest.
export function extractOpencodeAnswer(stdout: string): string {
  return stdout
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (t.startsWith(">")) return false;
      if (/^https?:\/\//.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

export async function runOpencode(messages: Msg[], spawn: SpawnFn = nodeSpawn, opts: RunOpts = {}): Promise<string> {
  // opencode picks its own project root unless told; --dir pins it to the repo.
  const args = ["run"];
  if (opts.cwd) args.push("--dir", opts.cwd);
  args.push(buildPrompt(messages));
  const out = await runProcess(spawn, "opencode", args, opts.cwd, opts.timeoutMs);
  return extractOpencodeAnswer(out);
}

export async function runGemini(messages: Msg[], spawn: SpawnFn = nodeSpawn, opts: RunOpts = {}): Promise<string> {
  // --skip-trust: required for headless runs in directories Gemini hasn't been
  // interactively trusted in (otherwise it refuses with exit 55).
  const args = ["-p", buildPrompt(messages), "--skip-trust"];
  if (opts.readOnly) args.push("--approval-mode", "plan");
  const out = await runProcess(spawn, "gemini", args, opts.cwd, opts.timeoutMs);
  return out.trim();
}

export function runCliAgent(
  backend: CliBackend,
  messages: Msg[],
  spawn: SpawnFn = nodeSpawn,
  opts: RunOpts = {},
): Promise<string> {
  if (backend === "claude") return runClaude(messages, spawn, opts);
  if (backend === "codex") return runCodex(messages, spawn, opts);
  if (backend === "opencode") return runOpencode(messages, spawn, opts);
  if (backend === "gemini") return runGemini(messages, spawn, opts);
  throw new Error(`unknown cli backend: ${backend}`);
}
