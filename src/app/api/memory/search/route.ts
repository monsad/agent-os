import { getStore } from "@/lib/ghost";
import { query as graphifyQuery } from "@/lib/graphify";

const NOTES_DIR = process.env.GRAPHIFY_NOTES_DIR ?? "./data/notes";

export async function POST(request: Request): Promise<Response> {
  let body: { q?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const q = body.q?.trim();
  if (!q) return Response.json({ error: "q required" }, { status: 400 });

  let graph: string | null = null;
  try {
    graph = await graphifyQuery(NOTES_DIR, q);
  } catch { /* graphify missing or no graph yet */ }

  let messages: { conversation_id: string; content: string }[] = [];
  try {
    messages = await getStore().searchMessages(q);
  } catch { /* ghost offline */ }

  return Response.json({ graph, messages });
}
