import { describe, it, expect, vi } from "vitest";
import { createStore } from "./ghost";

function fakePool(rows: unknown[] = []) {
  return { query: vi.fn(async (..._args: unknown[]) => ({ rows })) };
}

describe("ghost store", () => {
  it("initSchema issues CREATE TABLE statements", async () => {
    const pool = fakePool();
    const store = createStore(pool as never);
    await store.initSchema();
    const sql = pool.query.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).toMatch(/create table if not exists conversations/i);
    expect(sql).toMatch(/create table if not exists messages/i);
  });

  it("insertMessage parameterizes role and content", async () => {
    const pool = fakePool([{ id: 1 }]);
    const store = createStore(pool as never);
    await store.insertMessage("conv1", "user", "hi");
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/insert into messages/i);
    expect(params).toEqual(["conv1", "user", "hi"]);
  });

  it("searchMessages passes the ILIKE term as a bound parameter, not interpolated SQL", async () => {
    const pool = fakePool([]);
    const store = createStore(pool as never);
    await store.searchMessages("o'brien");
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).not.toContain("o'brien");
    expect(params).toEqual(["%o'brien%", 20]);
  });

  it("isAvailable returns false when the pool throws", async () => {
    const pool = { query: vi.fn(async () => { throw new Error("down"); }) };
    const store = createStore(pool as never);
    expect(await store.isAvailable()).toBe(false);
  });

  it("addGoal inserts the title as a bound parameter and returns the row", async () => {
    const pool = fakePool([{ id: 7, title: "ship", status: "open" }]);
    const store = createStore(pool as never);
    const goal = await store.addGoal("ship");
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/insert into goals/i);
    expect(params).toEqual(["ship"]);
    expect(goal).toEqual({ id: 7, title: "ship", status: "open" });
  });

  it("updateGoal coalesces partial fields and returns null when no row matches", async () => {
    const pool = fakePool([]);
    const store = createStore(pool as never);
    const result = await store.updateGoal(7, { status: "done" });
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/update goals set/i);
    expect(params).toEqual([7, null, "done"]);
    expect(result).toBeNull();
  });

  it("deleteGoal reports whether a row was removed", async () => {
    const pool = { query: vi.fn(async (..._args: unknown[]) => ({ rows: [] as unknown[], rowCount: 1 })) };
    const store = createStore(pool as never);
    expect(await store.deleteGoal(7)).toBe(true);
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/delete from goals/i);
    expect(params).toEqual([7]);
  });
});
