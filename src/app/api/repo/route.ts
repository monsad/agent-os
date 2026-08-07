import { getRepo, setRepoPath, cloneRepo } from "@/lib/repo";
import { readJson, invalidJson } from "@/lib/http";

export async function GET(): Promise<Response> {
  return Response.json(getRepo());
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ path?: string; url?: string }>(request);
  if (!body) return invalidJson();
  try {
    if (body.url) return Response.json(await cloneRepo(body.url));
    if (body.path) return Response.json(setRepoPath(body.path));
    return Response.json({ error: "path or url required" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
