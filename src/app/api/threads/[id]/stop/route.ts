import { currentUserId } from "@/lib/auth";
import { getStore } from "@/lib/ghost";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "bad id" }, { status: 400 });

  const store = getStore();
  if (!(await store.getThread(userId, id))) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  // Takes effect at the next hop boundary; an in-flight CLI process is not
  // killed. The UI says "stopping after this turn" until the status flips.
  await store.setThreadStatus(id, "stopped");
  return Response.json({ ok: true });
}
