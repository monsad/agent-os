import { rebuild } from "@/lib/graphify";

const NOTES_DIR = process.env.GRAPHIFY_NOTES_DIR ?? "./data/notes";

export async function POST(): Promise<Response> {
  try {
    await rebuild(NOTES_DIR);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "rebuild failed" },
      { status: 503 },
    );
  }
}
