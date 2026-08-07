import { synthesize } from "@/lib/voice";

// Assistant text → spoken WAV (piper, offline). The browser plays the bytes
// straight from an <audio> element, so JARVIS talks back.
export async function POST(request: Request): Promise<Response> {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return Response.json({ error: "no text" }, { status: 400 });

  try {
    const wav = await synthesize(text);
    return new Response(new Uint8Array(wav), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
