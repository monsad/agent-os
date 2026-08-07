import { initBrain, brainStatus, captureRaw } from "@/lib/brain";
import { readJson } from "@/lib/http";

export async function GET(): Promise<Response> {
  return Response.json(brainStatus());
}

export async function POST(request: Request): Promise<Response> {
  const body = (await readJson<{ action?: string; text?: string }>(request)) ?? {};
  if (body.action === "init") {
    await initBrain();
    return Response.json(brainStatus());
  }
  if (body.action === "capture" && body.text?.trim()) {
    await initBrain();
    const name = captureRaw(body.text);
    return Response.json({ captured: name, ...brainStatus() });
  }
  return Response.json({ error: "unknown action" }, { status: 400 });
}
