// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ currentUserId: vi.fn() }));
vi.mock("@/lib/ghost", () => ({ getStore: vi.fn() }));
vi.mock("@/lib/threadLoop", () => ({ startLoop: vi.fn() }));

import { currentUserId } from "@/lib/auth";
import { getStore } from "@/lib/ghost";
import type { Thread } from "@/lib/ghost";
import { startLoop } from "@/lib/threadLoop";
import { GET } from "./route";
import { POST as REPLY } from "./messages/route";
import { POST as STOP } from "./stop/route";

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const thread: Thread = { id: 7, user_id: 1, title: "t", repo_path: "/repos/app", status: "idle", created_at: "" };
const store = {
  getThread: vi.fn(async (): Promise<Thread | null> => thread),
  listThreadMessages: vi.fn(async () => []),
  addThreadMessage: vi.fn(async () => ({})),
  setThreadStatus: vi.fn(async () => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
  asMock(currentUserId).mockResolvedValue(1);
  asMock(getStore).mockReturnValue(store);
  store.getThread.mockResolvedValue(thread);
});

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) =>
  new Request("http://test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("GET /api/threads/[id]", () => {
  it("401s without a session", async () => {
    asMock(currentUserId).mockResolvedValue(null);
    expect((await GET(new Request("http://test"), params("7"))).status).toBe(401);
  });

  // Owner scoping is what stops one operator reading another's thread.
  it("404s for a thread the caller does not own", async () => {
    store.getThread.mockResolvedValue(null);
    expect((await GET(new Request("http://test"), params("7"))).status).toBe(404);
  });

  it("returns the thread with its messages", async () => {
    const res = await GET(new Request("http://test"), params("7"));
    expect(res.status).toBe(200);
    expect((await res.json()).thread.id).toBe(7);
    expect(store.listThreadMessages).toHaveBeenCalledWith(7);
  });

  it("400s on a non-numeric id", async () => {
    expect((await GET(new Request("http://test"), params("abc"))).status).toBe(400);
  });
});

describe("POST /api/threads/[id]/messages", () => {
  it("400s when the reply mentions nobody", async () => {
    const res = await REPLY(post({ message: "thanks" }), params("7"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_mentions");
  });

  // The operator is present and typing, so the risk the cap guards against is
  // not occurring: the reply starts a fresh run at hop 0.
  it("stores the reply at hop 0 and restarts the loop", async () => {
    const res = await REPLY(post({ message: "@claude why not?" }), params("7"));
    expect(res.status).toBe(201);
    expect(store.addThreadMessage).toHaveBeenCalledWith(7, expect.objectContaining({ author: "human", hop: 0 }));
    expect(startLoop).toHaveBeenCalled();
  });

  it("seeds the new run at hop 1", async () => {
    await REPLY(post({ message: "@claude why not?" }), params("7"));
    const [, seed] = asMock(startLoop).mock.calls[0];
    expect(seed).toEqual([{ agentId: "claude", hop: 1, mode: "discuss" }]);
  });

  it("409s while the thread is still running", async () => {
    store.getThread.mockResolvedValue({ ...thread, status: "running" });
    expect((await REPLY(post({ message: "@claude hi" }), params("7"))).status).toBe(409);
  });

  it("404s for a thread the caller does not own", async () => {
    store.getThread.mockResolvedValue(null);
    expect((await REPLY(post({ message: "@claude hi" }), params("7"))).status).toBe(404);
  });
});

describe("POST /api/threads/[id]/stop", () => {
  it("marks the thread stopped", async () => {
    const res = await STOP(new Request("http://test", { method: "POST" }), params("7"));
    expect(res.status).toBe(200);
    expect(store.setThreadStatus).toHaveBeenCalledWith(7, "stopped");
  });

  it("404s for a thread the caller does not own", async () => {
    store.getThread.mockResolvedValue(null);
    expect((await STOP(new Request("http://test", { method: "POST" }), params("7"))).status).toBe(404);
  });

  it("401s without a session", async () => {
    asMock(currentUserId).mockResolvedValue(null);
    expect((await STOP(new Request("http://test", { method: "POST" }), params("7"))).status).toBe(401);
  });
});
