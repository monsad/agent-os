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

  it("rebuild extracts, then clusters to render graph.html", async () => {
    const spawn = fakeSpawn("");
    await rebuild("./data/notes", spawn as never);

    expect(spawn).toHaveBeenCalledTimes(2);
    const [, extractArgs] = spawn.mock.calls[0] as unknown as [string, string[]];
    const [, clusterArgs] = spawn.mock.calls[1] as unknown as [string, string[]];

    expect(extractArgs).toContain("--update");
    expect(clusterArgs[0]).toBe("cluster-only");

    // --no-viz suppresses graph.html; --html isn't a real graphify flag and
    // hangs the CLI. Either one silently leaves the UI with no graph.
    for (const args of [extractArgs, clusterArgs]) {
      expect(args).not.toContain("--no-viz");
      expect(args).not.toContain("--html");
    }
  });

  it("rebuild rejects on non-zero exit", async () => {
    const spawn = fakeSpawn("boom", 1);
    await expect(rebuild("./data/notes", spawn as never)).rejects.toThrow(/graphify/);
  });
});
