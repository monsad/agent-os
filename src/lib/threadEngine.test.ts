import { describe, it, expect, vi } from "vitest";
import { runThread, MAX_HOPS, type EngineDeps } from "./threadEngine";
import type { ThreadMessage } from "./ghost";

/** Deps wired to canned replies. Nothing spawns a process. */
function deps(replies: Record<string, string>, over: Partial<EngineDeps> = {}) {
  const written: { author: string; body: string; hop: number }[] = [];
  const base: EngineDeps = {
    runTurn: vi.fn(async (agent) => replies[agent.id] ?? "nothing to add"),
    appendMessage: vi.fn(async (m) => {
      written.push({ author: m.author, body: m.body, hop: m.hop });
    }),
    loadTranscript: vi.fn(async () => [] as ThreadMessage[]),
    isStopped: vi.fn(async () => false),
  };
  return { deps: { ...base, ...over }, written };
}

describe("runThread", () => {
  it("runs the seeded speaker and stops when nobody is mentioned", async () => {
    const { deps: d, written } = deps({ claude: "here is my view" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ author: "claude", hop: 1 });
  });

  it("follows a mention to the next agent", async () => {
    const { deps: d, written } = deps({ claude: "not sure, @codex what do you think?", codex: "I agree" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written.map((w) => w.author)).toEqual(["claude", "codex"]);
    expect(written[1].hop).toBe(2);
  });

  // The safety property. Every reply mentions someone, so only the cap ends it.
  it("stops at the hop cap when agents keep handing off", async () => {
    const { deps: d, written } = deps({ claude: "@codex ?", codex: "@claude ?" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written).toHaveLength(MAX_HOPS);
  });

  it("ignores a mention of something that is not an agent", async () => {
    const { deps: d, written } = deps({ claude: "run @rm-rf now" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written).toHaveLength(1);
  });

  it("halts at the next hop boundary once stopped", async () => {
    const { deps: d, written } = deps(
      { claude: "@codex ?", codex: "@claude ?" },
      { isStopped: vi.fn(async () => true) },
    );
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(written).toHaveLength(0);
  });

  // One agent being logged out must not cost the rest of the conversation.
  it("records a failing turn and carries on", async () => {
    const { deps: d, written } = deps(
      { codex: "picking up where Claude left off" },
      {
        runTurn: vi.fn(async (agent) => {
          if (agent.id === "claude") throw new Error("claude exited 1");
          return "picking up where Claude left off";
        }),
      },
    );
    await runThread(
      [
        { agentId: "claude", hop: 1, mode: "discuss" },
        { agentId: "codex", hop: 1, mode: "discuss" },
      ],
      d,
    );
    expect(written).toHaveLength(2);
    expect(written[0].body).toContain("claude exited 1");
  });

  it("passes the turn mode through to the runner", async () => {
    const { deps: d } = deps({ claude: "ok" });
    await runThread([{ agentId: "claude", hop: 1, mode: "discuss" }], d);
    expect(d.runTurn).toHaveBeenCalledWith(expect.objectContaining({ id: "claude" }), [], "discuss");
  });
});
