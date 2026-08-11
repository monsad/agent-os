import { spawn as nodeSpawn } from "node:child_process";
import { spawnEnv } from "./spawnEnv";

// Local voice I/O choke point — mirrors lib/cliAgent.ts. Every mic→text and
// text→speech call shells out through here so binaries stay swappable + testable.
//   STT: ffmpeg (→16kHz mono WAV) → whisper.cpp `whisper-cli`
//   TTS: piper (neural, offline)
// Paths are env-configurable so the model files live outside the repo.
type SpawnFn = typeof nodeSpawn;
export type VoiceOpts = { timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 120_000;

export const FFMPEG_BIN = () => process.env.FFMPEG_BIN || "ffmpeg";
export const WHISPER_BIN = () => process.env.WHISPER_BIN || "whisper-cli";
export const WHISPER_MODEL = () => process.env.WHISPER_MODEL || "";
export const WHISPER_LANG = () => process.env.WHISPER_LANG || "auto";
export const PIPER_BIN = () => process.env.PIPER_BIN || "piper";
export const PIPER_VOICE = () => process.env.PIPER_VOICE || "";

// Run a child process, optionally feed stdin, resolve stdout as a Buffer.
function runProcess(
  spawn: SpawnFn,
  cmd: string,
  args: string[],
  stdin?: Buffer | string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { env: spawnEnv(), stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => {
        proc.kill("SIGKILL");
        reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
      });
    }, timeoutMs);

    proc.stdout?.on("data", (d) => out.push(Buffer.from(d)));
    proc.stderr?.on("data", (d) => { err += d.toString(); });
    proc.on("error", (e) => finish(() => reject(new Error(`${cmd} failed to start: ${e.message}`))));
    proc.on("close", (code) =>
      finish(() => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${cmd} exited ${code}: ${err}`)))),
    );

    if (stdin !== undefined) {
      proc.stdin?.write(stdin);
      proc.stdin?.end();
    }
  });
}

// Normalise any browser recording (webm/opus, m4a, …) to the 16kHz mono WAV
// whisper.cpp expects. ffmpeg reads the container, whisper only eats clean PCM.
export async function toWav16k(
  inputPath: string,
  outPath: string,
  spawn: SpawnFn = nodeSpawn,
  opts: VoiceOpts = {},
): Promise<void> {
  const args = ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", outPath];
  await runProcess(spawn, FFMPEG_BIN(), args, undefined, opts.timeoutMs);
}

// whisper.cpp → transcript text. `-nt` drops timestamps, `-np` silences progress,
// so stdout is just the spoken words.
export async function transcribe(
  wavPath: string,
  spawn: SpawnFn = nodeSpawn,
  opts: VoiceOpts = {},
): Promise<string> {
  const model = WHISPER_MODEL();
  if (!model) throw new Error("WHISPER_MODEL not set — point it at a ggml model (e.g. ggml-base.bin)");
  const args = ["-m", model, "-f", wavPath, "-nt", "-np", "-l", WHISPER_LANG()];
  const out = await runProcess(spawn, WHISPER_BIN(), args, undefined, opts.timeoutMs);
  return out.toString().trim();
}

// piper → WAV bytes. Text goes in on stdin; `--output_file -` streams the WAV
// (header + PCM) to stdout so the caller can hand it straight to <audio>.
export async function synthesize(
  text: string,
  spawn: SpawnFn = nodeSpawn,
  opts: VoiceOpts = {},
): Promise<Buffer> {
  const voice = PIPER_VOICE();
  if (!voice) throw new Error("PIPER_VOICE not set — point it at a piper .onnx voice model");
  const args = ["--model", voice, "--output_file", "-"];
  return runProcess(spawn, PIPER_BIN(), args, text, opts.timeoutMs);
}
