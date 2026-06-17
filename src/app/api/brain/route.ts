import { initBrain, brainStatus, captureRaw } from "@/lib/brain";

export async function GET(): Promise<Response> {
  return Response.json(brainStatus());
}

export async function POST(request: Request): Promise<Response> {
  let body: { action?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
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
