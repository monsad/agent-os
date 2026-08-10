import { currentUserId } from "@/lib/auth";
import { getStore } from "@/lib/ghost";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "bad id" }, { status: 400 });

  const store = getStore();
  const thread = await store.getThread(userId, id);
  if (!thread) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ thread, messages: await store.listThreadMessages(id) });
}
