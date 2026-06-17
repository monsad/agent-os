import { getRepo } from "@/lib/repo";
import { runCliAgent, type CliBackend } from "@/lib/cliAgent";

const COUNCIL: { id: string; name: string; backend: CliBackend }[] = [
  { id: "claude", name: "Claude", backend: "claude" },
  { id: "codex", name: "Codex", backend: "codex" },
  { id: "openclaw", name: "OpenClaw", backend: "opencode" },
  { id: "gemini", name: "Gemini", backend: "gemini" },
];

export async function POST(request: Request): Promise<Response> {
  let body: { question?: string; agents?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const question = body.question?.trim();
  if (!question) return Response.json({ error: "question required" }, { status: 400 });

  const repoPath = getRepo().repoPath;
  if (!repoPath) return Response.json({ error: "no_repo" }, { status: 400 });

  const selected = body.agents?.length ? COUNCIL.filter((c) => body.agents!.includes(c.id)) : COUNCIL;
  const messages = [{ role: "user", content: question }];

  const opinions = await Promise.all(
    selected.map(async (c) => {
      try {
        const answer = await runCliAgent(c.backend, messages, undefined, { cwd: repoPath, readOnly: true });
        return { id: c.id, name: c.name, answer, ok: true };
      } catch (e) {
        return { id: c.id, name: c.name, answer: e instanceof Error ? e.message : "failed", ok: false };
      }
    }),
  );

  return Response.json({ repo: repoPath, opinions });
}
