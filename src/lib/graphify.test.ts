import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { rebuild, query } from "./graphify";

function fakeSpawn(stdout: string, code = 0) {
  return vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter; stderr: EventEmitter;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    queueMicrotask(() => {
      proc.stdout.emit("data", Buffer.from(stdout));
      proc.emit("close", code);
    });
    return proc;
  });
}

describe("graphify runner", () => {
  it("query returns stdout on success", async () => {
    const spawn = fakeSpawn("Answer: 42\n");
    const out = await query("./data/notes", "what is the answer", spawn as never);
    expect(out).toContain("Answer: 42");
    expect(spawn).toHaveBeenCalledWith(
      "graphify",
      ["query", "what is the answer"],
      expect.anything(),
    );
  });

  it("rebuild rejects on non-zero exit", async () => {
    const spawn = fakeSpawn("boom", 1);
    await expect(rebuild("./data/notes", spawn as never)).rejects.toThrow(/graphify/);
  });
});
