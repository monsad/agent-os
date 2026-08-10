import { currentUserId } from "@/lib/auth";
import { getStore } from "@/lib/ghost";
import { readJson, invalidJson } from "@/lib/http";
import { resolveMentions } from "@/lib/mentions";
import { newBatchId } from "@/lib/runs";
import { startLoop } from "@/lib/threadLoop";
import type { ThreadTurn } from "@/lib/threadEngine";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "bad id" }, { status: 400 });

  const body = await readJson<{ message?: string }>(request);
  if (!body) return invalidJson();
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  const mentioned = resolveMentions(message);
  if (mentioned.length === 0) return Response.json({ error: "no_mentions" }, { status: 400 });

  const store = getStore();
  const thread = await store.getThread(userId, id);
  if (!thread) return Response.json({ error: "not found" }, { status: 404 });
  if (thread.status === "running") {
    return Response.json({ error: "thread_already_running" }, { status: 409 });
  }

  await store.addThreadMessage(id, {
    author: "human",
    body: message,
    mentions: mentioned.map((a) => a.id),
    hop: 0,
  });

  // hop starts at 1 again: the cap exists to protect an absent operator, and
  // one who is present and typing is not absent.
  const seed: ThreadTurn[] = mentioned.map((a) => ({ agentId: a.id, hop: 1, mode: "discuss" }));
  startLoop(id, seed, thread.repo_path ?? process.cwd(), newBatchId());

  return Response.json({ ok: true }, { status: 201 });
}
