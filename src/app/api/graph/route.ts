import { stat } from "node:fs/promises";
import path from "node:path";

export async function GET(): Promise<Response> {
  const htmlPath = path.join(process.cwd(), "graphify-out", "graph.html");
  try {
    const s = await stat(htmlPath);
    return Response.json({ exists: true, builtAt: s.mtime.toISOString() });
  } catch {
    return Response.json({ exists: false });
  }
}
