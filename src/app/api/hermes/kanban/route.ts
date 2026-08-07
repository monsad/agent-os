import { spawn } from "node:child_process";
import { readJson, invalidJson } from "@/lib/http";

function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("hermes", ["kanban", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", (d) => { err += d.toString(); });
    proc.on("error", (e) => reject(new Error(`hermes not found: ${e.message}`)));
    proc.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err || out || `exit ${code}`))));
  });
}

type Task = { id: string; title: string; status: string; assignee: string | null };

function parseTasks(json: string): Task[] {
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function GET(): Promise<Response> {
  try {
    return Response.json({ tasks: parseTasks(await run(["list", "--json"])) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed", tasks: [] }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ action?: string; title?: string; id?: string }>(request);
  if (!body) return invalidJson();
  try {
    if (body.action === "create" && body.title?.trim()) {
      await run(["create", body.title.trim(), "--json"]);
    } else if (body.action === "complete" && body.id) {
      await run(["complete", body.id]);
    } else {
      return Response.json({ error: "bad request" }, { status: 400 });
    }
    return Response.json({ tasks: parseTasks(await run(["list", "--json"])) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 503 });
  }
}
