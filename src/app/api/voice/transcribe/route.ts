import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { toWav16k, transcribe } from "@/lib/voice";

// Mic recording (webm/opus from the browser) → text. ffmpeg normalises the
// container to 16kHz WAV, whisper.cpp transcribes. Temp files are always cleaned.
export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "expected multipart form-data" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) return Response.json({ error: "no audio" }, { status: 400 });

  const dir = mkdtempSync(path.join(tmpdir(), "agentos-stt-"));
  const inPath = path.join(dir, "in");
  const wavPath = path.join(dir, "in.wav");
  try {
    writeFileSync(inPath, Buffer.from(await audio.arrayBuffer()));
    await toWav16k(inPath, wavPath);
    const text = await transcribe(wavPath);
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
