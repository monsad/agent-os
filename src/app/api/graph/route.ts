import { stat } from "node:fs/promises";
import { graphHtmlPath } from "@/lib/graphify";

const NOTES_DIR = process.env.GRAPHIFY_NOTES_DIR ?? "./data/notes";

export async function GET(): Promise<Response> {
  const htmlPath = graphHtmlPath(NOTES_DIR);
  try {
    const s = await stat(htmlPath);
    return Response.json({ exists: true, builtAt: s.mtime.toISOString() });
  } catch {
    return Response.json({ exists: false });
  }
}
