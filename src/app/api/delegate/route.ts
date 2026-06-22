import { spawn } from "node:child_process";
import { getRepo } from "@/lib/repo";
import { runCliAgent, type CliBackend } from "@/lib/cliAgent";
import { timedRun, newBatchId } from "@/lib/runs";

const AGENTS: { id: string; name: string; backend: CliBackend }[] = [
  { id: "claude", name: "Claude", backend: "claude" },
  { id: "codex", name: "Codex", backend: "codex" },
  { id: "openclaw", name: "OpenClaw", backend: "opencode" },
  { id: "gemini", name: "Gemini", backend: "gemini" },
];

// Register the task on the Hermes kanban so it's tracked/visible. Best-effort:
// if hermes isn't around, we still gather proposals.
function createKanbanTask(title: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn("hermes", ["kanban", "create", title, "--json"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.on("error", () => resolve(null));
    proc.on("close", () => {
      try {
        resolve(JSON.parse(out)?.id ?? null);
      } catch {
        resolve(null);
      }
    });
    setTimeout(() => { proc.kill("SIGKILL"); resolve(null); }, 15_000);
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: { task?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const task = body.task?.trim();
  if (!task) return Response.json({ error: "task required" }, { status: 400 });

  const repoPath = getRepo().repoPath;
  if (!repoPath) return Response.json({ error: "no_repo" }, { status: 400 });

  const taskId = await createKanbanTask(task);

  const prompt = `Task: ${task}

Read this repository and propose YOUR solution. Cover: the approach, the key
files you would change, and a short step-by-step plan. Be concrete and specific
to this codebase. Do not modify anything — propose only.`;

  const batchId = newBatchId();
  const proposals = await Promise.all(
    AGENTS.map(async (a) => {
      try {
        const answer = await timedRun(
          { feature: "delegate", agent: a.name, backend: a.backend, task: task.slice(0, 140), repo: repoPath, batchId },
          () => runCliAgent(a.backend, [{ role: "user", content: prompt }], undefined, { cwd: repoPath, readOnly: true }),
        );
        return { id: a.id, name: a.name, answer, ok: true };
      } catch (e) {
        return { id: a.id, name: a.name, answer: e instanceof Error ? e.message : "failed", ok: false };
      }
    }),
  );

  return Response.json({ task, taskId, repo: repoPath, proposals });
}
