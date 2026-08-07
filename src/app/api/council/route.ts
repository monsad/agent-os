import { getRepo } from "@/lib/repo";
import { runCliAgent } from "@/lib/cliAgent";
import { selectAgents } from "@/lib/roster";
import { timedRun, newBatchId } from "@/lib/runs";
import { readJson, invalidJson } from "@/lib/http";

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ question?: string; agents?: string[] }>(request);
  if (!body) return invalidJson();
  const question = body.question?.trim();
  if (!question) return Response.json({ error: "question required" }, { status: 400 });

  const repoPath = getRepo().repoPath;
  if (!repoPath) return Response.json({ error: "no_repo" }, { status: 400 });

  const selected = selectAgents(body.agents);
  const messages = [{ role: "user", content: question }];
  const batchId = newBatchId();

  const opinions = await Promise.all(
    selected.map(async (c) => {
      try {
        const answer = await timedRun(
          { feature: "council", agent: c.name, backend: c.backend, task: question.slice(0, 140), repo: repoPath, batchId },
          () => runCliAgent(c.backend, messages, undefined, { cwd: repoPath, readOnly: true, timeoutMs: 300_000 }),
        );
        return { id: c.id, name: c.name, answer, ok: true };
      } catch (e) {
        return { id: c.id, name: c.name, answer: e instanceof Error ? e.message : "failed", ok: false };
      }
    }),
  );

  return Response.json({ repo: repoPath, opinions });
}
