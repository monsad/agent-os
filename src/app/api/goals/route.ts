import { getStore } from "@/lib/ghost";
import { currentUserId } from "@/lib/auth";
import { suggestPriority } from "@/lib/priority";

export async function GET(request: Request): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json({ goals: await getStore().listGoals(userId) });
  } catch {
    return Response.json({ goals: [] });
  }
}

export async function POST(request: Request): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { title?: string; description?: string; deadline?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const title = body.title?.trim();
  if (!title) return Response.json({ error: "title required" }, { status: 400 });

  // Business logic: suggest a priority from the name, description and deadline.
  const priority = suggestPriority({ title, description: body.description, deadline: body.deadline });
  try {
    const goal = await getStore().addGoal(userId, {
      title,
      priority,
      description: body.description ?? null,
      deadline: body.deadline ?? null,
    });
    return Response.json({ goal }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: number; title?: string; status?: string; priority?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.id !== "number") return Response.json({ error: "id required" }, { status: 400 });
  try {
    const goal = await getStore().updateGoal(userId, body.id, {
      title: body.title,
      status: body.status,
      priority: body.priority,
    });
    if (!goal) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ goal });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const userId = await currentUserId(request);
  if (userId === null) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.id !== "number") return Response.json({ error: "id required" }, { status: 400 });
  try {
    const ok = await getStore().deleteGoal(userId, body.id);
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
