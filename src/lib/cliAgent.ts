import { spawn as nodeSpawn } from "node:child_process";

type SpawnFn = typeof nodeSpawn;
export type CliBackend = "claude" | "codex";
type Msg = { role: string; content: string };

const DEFAULT_TIMEOUT_MS = 120_000;

function runProcess(spawn: SpawnFn, cmd: string, args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    // stdin = "ignore" gives the child an immediate EOF; otherwise CLIs like
    // codex block forever waiting for piped input that never arrives.
    const proc = spawn(cmd, args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
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

export async function runClaude(messages: Msg[], spawn: SpawnFn = nodeSpawn): Promise<string> {
  const out = await runProcess(spawn, "claude", ["-p", buildPrompt(messages), "--output-format", "text"]);
  return out.trim();
}

export async function runCodex(messages: Msg[], spawn: SpawnFn = nodeSpawn): Promise<string> {
  const out = await runProcess(spawn, "codex", [
    "exec",
    "--skip-git-repo-check",
    "--color",
    "never",
    buildPrompt(messages),
  ]);
  return extractCodexAnswer(out);
}

export function runCliAgent(backend: CliBackend, messages: Msg[], spawn: SpawnFn = nodeSpawn): Promise<string> {
  if (backend === "claude") return runClaude(messages, spawn);
  if (backend === "codex") return runCodex(messages, spawn);
  throw new Error(`unknown cli backend: ${backend}`);
}
