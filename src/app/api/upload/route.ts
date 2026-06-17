import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setRepoPath } from "@/lib/repo";

const CONTEXT_DIR = path.join(process.cwd(), "data", "context");
const BRAIN_RAW_DIR = path.join(process.cwd(), "data", "brain", "0-raw");

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

  // target=brain drops raw captures into the second-brain intake instead.
  const target = String(form.get("target") ?? "context");
  const dir = target === "brain" ? BRAIN_RAW_DIR : CONTEXT_DIR;

  mkdirSync(dir, { recursive: true });
  const saved: string[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const name = safeName(file.name);
    writeFileSync(path.join(dir, name), buf);
    saved.push(name);
  }

  // Context uploads become the active workspace agents read from; brain intake does not.
  if (target !== "brain") setRepoPath(CONTEXT_DIR);

  return Response.json({ saved, dir });
}
