// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("@/lib/repo", () => ({ getRepo: vi.fn() }));
vi.mock("@/lib/cliAgent", () => ({ runCliAgent: vi.fn() }));
vi.mock("@/lib/runs", () => ({
  timedRun: vi.fn((_meta: unknown, fn: () => Promise<unknown>) => fn()),
  newBatchId: vi.fn(() => "batch1"),
}));
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

import { spawn } from "node:child_process";
import { getRepo } from "@/lib/repo";
import { runCliAgent } from "@/lib/cliAgent";
import { POST } from "./route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

/** Stand-in for the `hermes kanban create --json` child process. */
function fakeHermes(stdout: string, opts: { fail?: boolean } = {}) {
  return () => {
    const proc = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => void };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = () => {};
    queueMicrotask(() => {
      if (opts.fail) return proc.emit("error", new Error("hermes not installed"));
      proc.stdout.emit("data", Buffer.from(stdout));
      proc.emit("close", 0);
    });
    return proc;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  asMock(getRepo).mockReturnValue({ repoPath: "/repos/my-app" });
  asMock(runCliAgent).mockResolvedValue("my proposal");
  asMock(spawn).mockImplementation(fakeHermes(JSON.stringify({ id: "KAN-1" })));
});

function req(body: unknown): Request {
  return new Request("http://test/api/delegate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/delegate", () => {
  it("returns 400 without a task", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  it("returns 400 when no repo is attached", async () => {
    asMock(getRepo).mockReturnValue({ repoPath: null });
    expect((await POST(req({ task: "add rate limiting" }))).status).toBe(400);
  });

  it("logs the task on the kanban and collects a proposal per agent", async () => {
    const data = await (await POST(req({ task: "add rate limiting" }))).json();
    expect(data.taskId).toBe("KAN-1");
    expect(data.proposals).toHaveLength(3);
    expect(data.proposals.every((p: { ok: boolean }) => p.ok)).toBe(true);
  });

  // Hermes is optional tooling; losing the kanban entry shouldn't cost the work.
  it("still gathers proposals when hermes is unavailable", async () => {
    asMock(spawn).mockImplementation(fakeHermes("", { fail: true }));
    const data = await (await POST(req({ task: "add rate limiting" }))).json();
    expect(data.taskId).toBeNull();
    expect(data.proposals).toHaveLength(3);
  });

  it("survives unparseable kanban output", async () => {
    asMock(spawn).mockImplementation(fakeHermes("not json"));
    const data = await (await POST(req({ task: "t" }))).json();
    expect(data.taskId).toBeNull();
    expect(data.proposals).toHaveLength(3);
  });

  // Delegate asks for a plan, not an edit — agents must stay read-only.
  it("runs agents read-only so nothing is modified while proposing", async () => {
    await POST(req({ task: "t" }));
    for (const call of asMock(runCliAgent).mock.calls) {
      expect(call[3]).toMatchObject({ cwd: "/repos/my-app", readOnly: true });
    }
  });

  it("reports a failing agent without losing the rest", async () => {
    asMock(runCliAgent).mockRejectedValueOnce(new Error("codex exited 1")).mockResolvedValue("ok");
    const data = await (await POST(req({ task: "t" }))).json();
    expect(data.proposals.filter((p: { ok: boolean }) => !p.ok)).toHaveLength(1);
    expect(data.proposals.filter((p: { ok: boolean }) => p.ok)).toHaveLength(2);
  });
});
