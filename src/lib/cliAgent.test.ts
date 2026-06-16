import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { runClaude, runCliAgent, buildPrompt, extractCodexAnswer, extractOpencodeAnswer, runOpencode, runGemini } from "./cliAgent";

function fakeSpawn(stdout: string, code = 0) {
  return vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    queueMicrotask(() => {
      proc.stdout.emit("data", Buffer.from(stdout));
      proc.emit("close", code);
    });
    return proc;
  });
}

describe("buildPrompt", () => {
  it("flattens the conversation and cues the assistant", () => {
    const p = buildPrompt([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "how are you" },
    ]);
    expect(p).toBe("user: hi\nassistant: hello\nuser: how are you\nassistant:");
  });
});

describe("extractCodexAnswer", () => {
  it("pulls the text between the codex marker and the tokens line", () => {
    const raw = ["--------", "user", "say hi", "codex", "Hello there", "tokens used", "24.0"].join("\n");
    expect(extractCodexAnswer(raw)).toBe("Hello there");
  });

  it("falls back to the whole output when no marker is present", () => {
    expect(extractCodexAnswer("just text")).toBe("just text");
  });
});

describe("runClaude", () => {
  it("calls the claude CLI in print mode and returns trimmed stdout", async () => {
    const spawn = fakeSpawn("hello\n");
    const out = await runClaude([{ role: "user", content: "hi" }], spawn as never);
    expect(out).toBe("hello");
    expect(spawn).toHaveBeenCalledWith(
      "claude",
      ["-p", "user: hi\nassistant:", "--output-format", "text"],
      expect.anything(),
    );
  });

  it("rejects on a non-zero exit", async () => {
    const spawn = fakeSpawn("boom", 1);
    await expect(runClaude([{ role: "user", content: "hi" }], spawn as never)).rejects.toThrow(/claude/);
  });
});

describe("extractOpencodeAnswer", () => {
  it("strips the build banner, urls, and ANSI codes", () => {
    const raw = [
      "  https://github.com/oven-sh/bun/releases/download/bun.zip",
      "> build · big-pickle",
      "\x1b[0mHello there\x1b[0m",
    ].join("\n");
    expect(extractOpencodeAnswer(raw)).toBe("Hello there");
  });
});

describe("runOpencode", () => {
  it("invokes `opencode run` with the flattened prompt", async () => {
    const spawn = fakeSpawn("> build · x\nready\n");
    const out = await runOpencode([{ role: "user", content: "hi" }], spawn as never);
    expect(out).toBe("ready");
    expect(spawn).toHaveBeenCalledWith("opencode", ["run", "user: hi\nassistant:"], expect.anything());
  });
});

describe("runGemini", () => {
  it("invokes `gemini -p` with the flattened prompt", async () => {
    const spawn = fakeSpawn("answer\n");
    const out = await runGemini([{ role: "user", content: "hi" }], spawn as never);
    expect(out).toBe("answer");
    expect(spawn).toHaveBeenCalledWith("gemini", ["-p", "user: hi\nassistant:"], expect.anything());
  });
});

describe("runCliAgent", () => {
  it("throws on an unknown backend", () => {
    expect(() => runCliAgent("bogus" as never, [])).toThrow(/unknown cli backend/);
  });
});
