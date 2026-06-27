import { getStore } from "@/lib/ghost";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ goals: await getStore().listGoals() });
  } catch {
    return Response.json({ goals: [] });
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const title = body.title?.trim();
  if (!title) return Response.json({ error: "title required" }, { status: 400 });
  try {
    return Response.json({ goal: await getStore().addGoal(title) }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  let body: { id?: number; title?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.id !== "number") return Response.json({ error: "id required" }, { status: 400 });
  try {
    const goal = await getStore().updateGoal(body.id, { title: body.title, status: body.status });
    if (!goal) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ goal });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  let body: { id?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.id !== "number") return Response.json({ error: "id required" }, { status: 400 });
  try {
    const ok = await getStore().deleteGoal(body.id);
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
