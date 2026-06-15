import { getStore } from "@/lib/ghost";
import { appendTurn } from "@/lib/notes";

const NOTES_DIR = process.env.GRAPHIFY_NOTES_DIR ?? "./data/notes";

export async function POST(request: Request): Promise<Response> {
  let body: { conversationId?: string; role?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const { conversationId, role, content } = body;
  if (!conversationId || !role || !content) {
    return Response.json({ error: "conversationId, role, content required" }, { status: 400 });
  }

  let notesOk = false;
  try {
    await appendTurn(NOTES_DIR, conversationId, role, content);
    notesOk = true;
  } catch { /* non-fatal */ }

  let ghostOk = false;
  try {
    await getStore().insertMessage(conversationId, role, content);
    ghostOk = true;
  } catch { /* non-fatal */ }

  return Response.json({ ok: notesOk || ghostOk, notes: notesOk, ghost: ghostOk });
}
