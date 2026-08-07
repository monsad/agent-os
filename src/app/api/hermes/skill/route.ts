import { spawn } from "node:child_process";
import { readJson, invalidJson } from "@/lib/http";

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("hermes", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", (d) => { out += d.toString(); });
    proc.on("error", (e) => reject(new Error(`hermes not found: ${e.message}`)));
    proc.on("close", () => resolve(out));
    // agentic skill runs can take a while
    setTimeout(() => { proc.kill("SIGKILL"); reject(new Error("hermes skill run timed out")); }, 300_000);
  });
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ skill?: string; prompt?: string }>(request);
  if (!body) return invalidJson();
  const skill = body.skill?.trim();
  const prompt = body.prompt?.trim();
  if (!skill || !prompt) return Response.json({ error: "skill and prompt required" }, { status: 400 });

  try {
    const output = stripAnsi(await run(["-z", prompt, "--skills", skill]));
    return Response.json({ skill, output });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "skill run failed" }, { status: 503 });
  }
}
