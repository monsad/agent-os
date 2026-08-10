// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cliAgent", () => ({ runCliAgent: vi.fn() }));
vi.mock("@/lib/runs", () => ({
  timedRun: vi.fn((_meta: unknown, fn: () => Promise<unknown>) => fn()),
  newBatchId: vi.fn(() => "batch1"),
}));

import { runCliAgent } from "@/lib/cliAgent";
import { timedRun } from "@/lib/runs";
import { makeTurnRunner } from "./threadRunner";
import type { ThreadMessage } from "./ghost";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  asMock(runCliAgent).mockResolvedValue("my reply");
});

const agent = { id: "codex", name: "Codex", backend: "codex" as const };
const transcript: ThreadMessage[] = [
  { id: 1, thread_id: 1, author: "human", body: "is the index worth it?", mentions: [], hop: 0, created_at: "" },
];

describe("makeTurnRunner", () => {
  it("returns the agent's reply", async () => {
    const run = makeTurnRunner({ repoPath: "/repos/app", batchId: "b1" });
    expect(await run(agent, transcript, "discuss")).toBe("my reply");
  });

  // Block 1 is a conversation about code, not a change to it.
  it("runs the agent read-only against the thread's repo", async () => {
    const run = makeTurnRunner({ repoPath: "/repos/app", batchId: "b1" });
    await run(agent, transcript, "discuss");
    const [, , , opts] = asMock(runCliAgent).mock.calls[0];
    expect(opts).toMatchObject({ cwd: "/repos/app", readOnly: true });
  });

  it("sends the transcript as the prompt", async () => {
    const run = makeTurnRunner({ repoPath: "/repos/app", batchId: "b1" });
    await run(agent, transcript, "discuss");
    const [, messages] = asMock(runCliAgent).mock.calls[0];
    expect(messages[0].content).toContain("is the index worth it?");
  });

  // Observability groups a thread's turns the way it groups a council fan-out.
  it("records the run under the threads feature with the thread's batch id", async () => {
    const run = makeTurnRunner({ repoPath: "/repos/app", batchId: "b1" });
    await run(agent, transcript, "discuss");
    const [meta] = asMock(timedRun).mock.calls[0];
    expect(meta).toMatchObject({ feature: "threads", agent: "Codex", backend: "codex", batchId: "b1", repo: "/repos/app" });
  });
});
