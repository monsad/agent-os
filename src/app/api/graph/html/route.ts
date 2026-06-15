import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(): Promise<Response> {
  const htmlPath = path.join(process.cwd(), "graphify-out", "graph.html");
  try {
    const html = await readFile(htmlPath, "utf-8");
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response("graph not built", { status: 404 });
  }
}
