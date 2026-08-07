import { readFile } from "node:fs/promises";
import { graphHtmlPath } from "@/lib/graphify";

const NOTES_DIR = process.env.GRAPHIFY_NOTES_DIR ?? "./data/notes";

export async function GET(): Promise<Response> {
  const htmlPath = graphHtmlPath(NOTES_DIR);
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
