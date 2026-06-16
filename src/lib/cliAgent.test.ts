import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { runClaude, runCliAgent, buildPrompt, extractCodexAnswer } from "./cliAgent";

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

describe("runCliAgent", () => {
  it("throws on an unknown backend", () => {
    expect(() => runCliAgent("bogus" as never, [])).toThrow(/unknown cli backend/);
  });
});
