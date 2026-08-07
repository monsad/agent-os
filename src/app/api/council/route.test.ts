// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/repo", () => ({ getRepo: vi.fn() }));
vi.mock("@/lib/cliAgent", () => ({ runCliAgent: vi.fn() }));
vi.mock("@/lib/runs", () => ({
  timedRun: vi.fn((_meta: unknown, fn: () => Promise<unknown>) => fn()),
  newBatchId: vi.fn(() => "batch1"),
}));

import { getRepo } from "@/lib/repo";
import { runCliAgent } from "@/lib/cliAgent";
import { POST } from "./route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  asMock(getRepo).mockReturnValue({ repoPath: "/repos/my-app" });
  asMock(runCliAgent).mockResolvedValue("an opinion");
});

function req(body: unknown): Request {
  return new Request("http://test/api/council", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/council", () => {
  it("returns 400 without a question", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ question: "   " }))).status).toBe(400);
  });

  it("returns 400 when no repo is attached", async () => {
    asMock(getRepo).mockReturnValue({ repoPath: null });
    const res = await POST(req({ question: "where are the risks?" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_repo");
  });

  it("asks every roster agent and returns each opinion", async () => {
    const res = await POST(req({ question: "where are the risks?" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.opinions).toHaveLength(3);
    expect(data.opinions.every((o: { ok: boolean }) => o.ok)).toBe(true);
    expect(runCliAgent).toHaveBeenCalledTimes(3);
  });

  it("honours an explicit agent selection", async () => {
    const res = await POST(req({ question: "q", agents: ["claude"] }));
    expect((await res.json()).opinions).toHaveLength(1);
    expect(runCliAgent).toHaveBeenCalledTimes(1);
  });

  // One agent being logged out shouldn't cost the answers from the others.
  it("reports a failing agent without losing the rest", async () => {
    asMock(runCliAgent)
      .mockRejectedValueOnce(new Error("claude exited 1"))
      .mockResolvedValue("an opinion");

    const data = await (await POST(req({ question: "q" }))).json();
    const failed = data.opinions.filter((o: { ok: boolean }) => !o.ok);
    expect(failed).toHaveLength(1);
    expect(failed[0].answer).toContain("claude exited 1");
    expect(data.opinions.filter((o: { ok: boolean }) => o.ok)).toHaveLength(2);
  });

  // Council is a question, not a change: agents must not be able to edit the repo.
  it("runs every agent read-only against the attached repo", async () => {
    await POST(req({ question: "q" }));
    for (const call of asMock(runCliAgent).mock.calls) {
      expect(call[3]).toMatchObject({ cwd: "/repos/my-app", readOnly: true });
    }
  });
});
