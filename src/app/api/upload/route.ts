import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setRepoPath } from "@/lib/repo";

const CONTEXT_DIR = path.join(process.cwd(), "data", "context");

function safeName(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+/, "") || "file";
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "expected multipart form-data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return Response.json({ error: "no files" }, { status: 400 });

  mkdirSync(CONTEXT_DIR, { recursive: true });
  const saved: string[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const name = safeName(file.name);
    writeFileSync(path.join(CONTEXT_DIR, name), buf);
    saved.push(name);
  }

  // Uploaded files become the active workspace the agents read from.
  setRepoPath(CONTEXT_DIR);

  return Response.json({ saved, dir: CONTEXT_DIR });
}
