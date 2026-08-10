// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/repo", () => ({ getRepo: vi.fn() }));
vi.mock("@/lib/ghost", () => ({ getStore: vi.fn() }));
// Mock the loop starter, not the engine. `startLoop` deliberately does not await
// its work, so asserting on `runThread` from here would race the fire-and-forget
// and pass or fail depending on timing.
vi.mock("@/lib/threadLoop", () => ({ startLoop: vi.fn() }));

import { currentUserId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { getStore } from "@/lib/ghost";
import { startLoop } from "@/lib/threadLoop";
import { POST, GET } from "./route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const store = {
  createThread: vi.fn(async () => ({ id: 7, user_id: 1, title: "t", repo_path: "/repos/app", status: "idle", created_at: "" })),
  listThreads: vi.fn(async () => []),
  addThreadMessage: vi.fn(async () => ({})),
  hasRunningThread: vi.fn(async () => false),
};

beforeEach(() => {
  vi.clearAllMocks();
  asMock(currentUserId).mockResolvedValue(1);
  asMock(getRepo).mockReturnValue({ repoPath: "/repos/app" });
  asMock(getStore).mockReturnValue(store);
  store.hasRunningThread.mockResolvedValue(false);
});

function req(body: unknown): Request {
  return new Request("http://test/api/threads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/threads", () => {
  it("401s without a session", async () => {
    asMock(currentUserId).mockResolvedValue(null);
    expect((await POST(req({ message: "@claude hi" }))).status).toBe(401);
  });

  it("400s on malformed json", async () => {
    const bad = new Request("http://test/api/threads", {
      method: "POST",
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    });
    expect((await POST(bad)).status).toBe(400);
  });

  it("400s on an empty message", async () => {
    expect((await POST(req({ message: "  " }))).status).toBe(400);
  });

  // No implicit default speaker: a thread that silently runs the wrong agent is
  // worse than one that refuses to start.
  it("400s when the opening message mentions nobody", async () => {
    const res = await POST(req({ message: "what do we think?" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_mentions");
  });

  it("400s when no repo is attached", async () => {
    asMock(getRepo).mockReturnValue({ repoPath: null });
    expect((await POST(req({ message: "@claude hi" }))).status).toBe(400);
  });

  // Two threads at five hops each is ten parallel CLI invocations.
  it("409s while another thread is running", async () => {
    store.hasRunningThread.mockResolvedValue(true);
    expect((await POST(req({ message: "@claude hi" }))).status).toBe(409);
  });

  it("creates the thread, stores the opening message and starts the loop", async () => {
    const res = await POST(req({ message: "@claude is the index worth it?" }));
    expect(res.status).toBe(201);
    expect((await res.json()).thread.id).toBe(7);
    expect(store.addThreadMessage).toHaveBeenCalledWith(7, expect.objectContaining({ author: "human", hop: 0 }));
    expect(startLoop).toHaveBeenCalled();
  });

  it("seeds the loop with the mentioned agents only", async () => {
    await POST(req({ message: "@codex and @openclaw please" }));
    const [, seed] = asMock(startLoop).mock.calls[0];
    expect(seed.map((t: { agentId: string }) => t.agentId)).toEqual(["codex", "openclaw"]);
  });
});

describe("GET /api/threads", () => {
  it("401s without a session", async () => {
    asMock(currentUserId).mockResolvedValue(null);
    expect((await GET(new Request("http://test/api/threads"))).status).toBe(401);
  });

  it("lists the operator's threads", async () => {
    const res = await GET(new Request("http://test/api/threads"));
    expect(res.status).toBe(200);
    expect(store.listThreads).toHaveBeenCalledWith(1);
  });
});
