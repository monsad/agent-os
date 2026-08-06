import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { toWav16k, transcribe, synthesize } from "./voice";

// Fake child process: emits `stdout` bytes then closes, and records anything
// written to stdin (piper reads its text there).
function fakeSpawn(stdout: Buffer | string, code = 0) {
  const stdinChunks: Buffer[] = [];
  const spawn = vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter; stderr: EventEmitter;
      stdin: { write: (c: Buffer | string) => void; end: () => void };
      kill: () => void;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = { write: (c) => stdinChunks.push(Buffer.from(c)), end: () => {} };
    proc.kill = () => {};
    queueMicrotask(() => {
      proc.stdout.emit("data", Buffer.from(stdout));
      proc.emit("close", code);
    });
    return proc;
  });
  return { spawn, stdin: () => Buffer.concat(stdinChunks).toString() };
}

afterEach(() => {
  delete process.env.WHISPER_MODEL;
  delete process.env.PIPER_VOICE;
  delete process.env.WHISPER_LANG;
});

describe("toWav16k", () => {
  it("invokes ffmpeg to produce 16kHz mono pcm_s16le", async () => {
    const { spawn } = fakeSpawn("");
    await toWav16k("/tmp/in.webm", "/tmp/out.wav", spawn as never);
    expect(spawn).toHaveBeenCalledWith(
      "ffmpeg",
      ["-y", "-i", "/tmp/in.webm", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "/tmp/out.wav"],
      expect.anything(),
    );
  });
});

describe("transcribe", () => {
  it("calls whisper-cli with the model and returns trimmed text", async () => {
    process.env.WHISPER_MODEL = "/models/ggml-base.bin";
    process.env.WHISPER_LANG = "pl";
    const { spawn } = fakeSpawn("  Dzień dobry Sejmie  \n");
    const out = await transcribe("/tmp/in.wav", spawn as never);
    expect(out).toBe("Dzień dobry Sejmie");
    expect(spawn).toHaveBeenCalledWith(
      "whisper-cli",
      ["-m", "/models/ggml-base.bin", "-f", "/tmp/in.wav", "-nt", "-np", "-l", "pl"],
      expect.anything(),
    );
  });

  it("throws when WHISPER_MODEL is unset", async () => {
    const { spawn } = fakeSpawn("x");
    await expect(transcribe("/tmp/in.wav", spawn as never)).rejects.toThrow(/WHISPER_MODEL/);
  });

  it("rejects on a non-zero whisper exit", async () => {
    process.env.WHISPER_MODEL = "/models/ggml-base.bin";
    const { spawn } = fakeSpawn("", 1);
    await expect(transcribe("/tmp/in.wav", spawn as never)).rejects.toThrow(/whisper-cli exited/);
  });
});

describe("synthesize", () => {
  it("feeds text to piper on stdin and returns the WAV bytes", async () => {
    process.env.PIPER_VOICE = "/voices/en_US.onnx";
    const wav = Buffer.from("RIFFxxxxWAVE");
    const { spawn, stdin } = fakeSpawn(wav);
    const out = await synthesize("Hello operator", spawn as never);
    expect(out.equals(wav)).toBe(true);
    expect(stdin()).toBe("Hello operator");
    expect(spawn).toHaveBeenCalledWith(
      "piper",
      ["--model", "/voices/en_US.onnx", "--output_file", "-"],
      expect.anything(),
    );
  });

  it("throws when PIPER_VOICE is unset", async () => {
    const { spawn } = fakeSpawn("x");
    await expect(synthesize("hi", spawn as never)).rejects.toThrow(/PIPER_VOICE/);
  });
});
