// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/brain", () => ({
  BRAIN_DIR: "/brain",
  initBrain: vi.fn(),
  rawFiles: vi.fn(),
  brainStatus: vi.fn(),
  commitBrain: vi.fn(),
}));
vi.mock("@/lib/cliAgent", () => ({ runClaude: vi.fn() }));

import { initBrain, rawFiles, brainStatus, commitBrain } from "@/lib/brain";
import { runClaude } from "@/lib/cliAgent";
import { POST } from "./route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  asMock(initBrain).mockResolvedValue(undefined);
  asMock(rawFiles).mockReturnValue(["capture-1.md", "capture-2.md"]);
  asMock(runClaude).mockResolvedValue("Processed 2 captures into 5 atoms.");
  asMock(commitBrain).mockResolvedValue(undefined);
  asMock(brainStatus).mockReturnValue({ raw: 0, atoms: 5, threads: 1, briefings: 1 });
});

describe("POST /api/brain/refine", () => {
  it("refuses to run a shift on an empty intake", async () => {
    asMock(rawFiles).mockReturnValue([]);
    const res = await POST();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("empty_raw");
    expect(runClaude).not.toHaveBeenCalled();
  });

  it("returns the shift summary and the resulting brain status", async () => {
    const res = await POST();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.summary).toContain("5 atoms");
    expect(data.atoms).toBe(5);
  });

  // The refiner writes atoms, so it needs write mode and must be pinned to the
  // brain — pointed anywhere else it would edit the wrong files.
  it("runs Claude in write mode inside the brain directory", async () => {
    await POST();
    const [, , opts] = asMock(runClaude).mock.calls[0];
    expect(opts).toMatchObject({ cwd: "/brain", write: true });
  });

  it("tells the agent how many captures are waiting and where to file them", async () => {
    await POST();
    const [messages] = asMock(runClaude).mock.calls[0];
    const prompt = messages[0].content as string;
    expect(prompt).toContain("there are 2");
    expect(prompt).toContain("house-rules.md");
    expect(prompt).toContain("2-atoms/");
  });

  // A shift that wrote files but wasn't committed would be lost on the next run.
  it("commits the brain after a successful shift", async () => {
    await POST();
    expect(commitBrain).toHaveBeenCalledTimes(1);
  });

  it("returns 503 and commits nothing when the agent fails", async () => {
    asMock(runClaude).mockRejectedValue(new Error("claude exited 1"));
    const res = await POST();
    expect(res.status).toBe(503);
    expect(commitBrain).not.toHaveBeenCalled();
  });

  it("initialises the brain before touching it", async () => {
    await POST();
    expect(initBrain).toHaveBeenCalled();
  });
});
