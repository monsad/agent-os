import { currentUserId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { getStore } from "@/lib/ghost";
import { readJson, invalidJson } from "@/lib/http";
import { resolveMentions } from "@/lib/mentions";
import { newBatchId } from "@/lib/runs";
import type { ThreadTurn } from "@/lib/threadEngine";
import { startLoop } from "@/lib/threadLoop";

export async function GET(request: Request): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ threads: await getStore().listThreads(userId) });
}

export async function POST(request: Request): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await readJson<{ message?: string }>(request);
  if (!body) return invalidJson();
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "message required" }, { status: 400 });

  const mentioned = resolveMentions(message);
  if (mentioned.length === 0) return Response.json({ error: "no_mentions" }, { status: 400 });

  const repoPath = getRepo().repoPath;
  if (!repoPath) return Response.json({ error: "no_repo" }, { status: 400 });

  const store = getStore();
  if (await store.hasRunningThread(userId)) {
    return Response.json({ error: "thread_already_running" }, { status: 409 });
  }

  const thread = await store.createThread(userId, message.slice(0, 80), repoPath);
  await store.addThreadMessage(thread.id, {
    author: "human",
    body: message,
    mentions: mentioned.map((a) => a.id),
    hop: 0,
  });

  const seed: ThreadTurn[] = mentioned.map((a) => ({ agentId: a.id, hop: 1, mode: "discuss" }));
  startLoop(thread.id, seed, repoPath, newBatchId());

  return Response.json({ thread }, { status: 201 });
}
