import { describe, it, expect, vi, beforeEach } from "vitest";

const store = {
  listGoals: vi.fn(),
  addGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
};
vi.mock("@/lib/ghost", () => ({ getStore: () => store }));

import { GET, POST, PATCH, DELETE } from "./route";

function req(method: string, body: unknown): Request {
  return new Request("http://localhost/api/goals", { method, body: JSON.stringify(body) });
}

describe("goals API — full CRUD", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET lists goals (read)", async () => {
    store.listGoals.mockResolvedValue([{ id: 1, title: "ship MVP", status: "open" }]);
    const res = await GET();
    expect(await res.json()).toEqual({ goals: [{ id: 1, title: "ship MVP", status: "open" }] });
  });

  it("POST creates a goal (create)", async () => {
    store.addGoal.mockResolvedValue({ id: 2, title: "write tests", status: "open" });
    const res = await POST(req("POST", { title: "write tests" }));
    expect(res.status).toBe(201);
    expect(store.addGoal).toHaveBeenCalledWith("write tests");
    expect(await res.json()).toEqual({ goal: { id: 2, title: "write tests", status: "open" } });
  });

  it("POST rejects an empty title", async () => {
    const res = await POST(req("POST", { title: "   " }));
    expect(res.status).toBe(400);
    expect(store.addGoal).not.toHaveBeenCalled();
  });

  it("PATCH updates a goal's status (update)", async () => {
    store.updateGoal.mockResolvedValue({ id: 1, title: "ship MVP", status: "done" });
    const res = await PATCH(req("PATCH", { id: 1, status: "done" }));
    expect(res.status).toBe(200);
    expect(store.updateGoal).toHaveBeenCalledWith(1, { title: undefined, status: "done" });
  });

  it("PATCH returns 404 when the goal is missing", async () => {
    store.updateGoal.mockResolvedValue(null);
    const res = await PATCH(req("PATCH", { id: 99, status: "done" }));
    expect(res.status).toBe(404);
  });

  it("DELETE removes a goal (delete)", async () => {
    store.deleteGoal.mockResolvedValue(true);
    const res = await DELETE(req("DELETE", { id: 1 }));
    expect(res.status).toBe(200);
    expect(store.deleteGoal).toHaveBeenCalledWith(1);
  });

  it("DELETE returns 404 when nothing was removed", async () => {
    store.deleteGoal.mockResolvedValue(false);
    const res = await DELETE(req("DELETE", { id: 99 }));
    expect(res.status).toBe(404);
  });
});
