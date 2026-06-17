import { getRepo, setRepoPath, cloneRepo } from "@/lib/repo";

export async function GET(): Promise<Response> {
  return Response.json(getRepo());
}

export async function POST(request: Request): Promise<Response> {
  let body: { path?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    if (body.url) return Response.json(await cloneRepo(body.url));
    if (body.path) return Response.json(setRepoPath(body.path));
    return Response.json({ error: "path or url required" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
