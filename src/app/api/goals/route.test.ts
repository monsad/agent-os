import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

const store = {
  listGoals: vi.fn(),
  addGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
};
vi.mock("@/lib/ghost", () => ({ getStore: () => store }));

import { GET, POST, PATCH, DELETE } from "./route";

let cookie: string;
beforeAll(async () => {
  process.env.AGENT_OS_SESSION_SECRET = "test-secret";
  cookie = `${SESSION_COOKIE}=${encodeURIComponent(await signSession(1))}`;
});

function req(method: string, body: unknown, withAuth = true): Request {
  return new Request("http://localhost/api/goals", {
    method,
    headers: withAuth ? { cookie } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("goals API — per-user CRUD", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unauthenticated request (risk R1: access control)", async () => {
    const res = await GET(req("GET", undefined, false));
    expect(res.status).toBe(401);
    expect(store.listGoals).not.toHaveBeenCalled();
  });

  it("GET lists only the caller's goals (read)", async () => {
    store.listGoals.mockResolvedValue([{ id: 1, user_id: 1, title: "ship", status: "open", priority: "low" }]);
    const res = await GET(req("GET", undefined));
    expect(store.listGoals).toHaveBeenCalledWith(1);
    expect((await res.json()).goals).toHaveLength(1);
  });

  it("POST creates a goal with an auto-suggested priority (create + business logic)", async () => {
    store.addGoal.mockResolvedValue({ id: 2, user_id: 1, title: "URGENT fix", status: "open", priority: "high" });
    const res = await POST(req("POST", { title: "URGENT fix" }));
    expect(res.status).toBe(201);
    const [uid, fields] = store.addGoal.mock.calls.at(-1)!;
    expect(uid).toBe(1);
    expect(fields.priority).toBe("high"); // suggestPriority derived from the title
  });

  it("POST rejects an empty title", async () => {
    const res = await POST(req("POST", { title: "   " }));
    expect(res.status).toBe(400);
    expect(store.addGoal).not.toHaveBeenCalled();
  });

  it("PATCH updates the caller's goal (update)", async () => {
    store.updateGoal.mockResolvedValue({ id: 1, user_id: 1, title: "ship", status: "done", priority: "low" });
    const res = await PATCH(req("PATCH", { id: 1, status: "done" }));
    expect(res.status).toBe(200);
    expect(store.updateGoal).toHaveBeenCalledWith(1, 1, { title: undefined, status: "done", priority: undefined });
  });

  it("DELETE removes the caller's goal (delete)", async () => {
    store.deleteGoal.mockResolvedValue(true);
    const res = await DELETE(req("DELETE", { id: 1 }));
    expect(res.status).toBe(200);
    expect(store.deleteGoal).toHaveBeenCalledWith(1, 1);
  });

  it("DELETE returns 404 when the goal is not the caller's (risk R2: tenant isolation)", async () => {
    store.deleteGoal.mockResolvedValue(false);
    const res = await DELETE(req("DELETE", { id: 99 }));
    expect(res.status).toBe(404);
  });
});
