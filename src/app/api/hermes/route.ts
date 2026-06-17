import { spawn } from "node:child_process";

// Whitelisted, read-only hermes subcommands — none of these invoke the model,
// so the control panel works even while the model provider is misconfigured.
const COMMANDS: Record<string, string[]> = {
  status: ["status"],
  skills: ["skills", "list"],
  kanban: ["kanban", "list"],
  "kanban-stats": ["kanban", "stats"],
  plugins: ["plugins", "list"],
  sessions: ["sessions", "list"],
};

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("hermes", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", (d) => { out += d.toString(); });
    proc.on("error", (e) => reject(new Error(`hermes not found: ${e.message}`)));
    proc.on("close", () => resolve(out));
  });
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

export async function POST(request: Request): Promise<Response> {
  let body: { cmd?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const args = body.cmd ? COMMANDS[body.cmd] : undefined;
  if (!args) return Response.json({ error: "unknown command" }, { status: 400 });

  try {
    const output = stripAnsi(await run(args));
    return Response.json({ cmd: body.cmd, output });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "hermes failed" }, { status: 503 });
  }
}
