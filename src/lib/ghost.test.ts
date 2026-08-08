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

  it("addGoal binds the owner, title and priority and returns the row", async () => {
    const pool = fakePool([{ id: 7, user_id: 1, title: "ship", status: "open", priority: "high" }]);
    const store = createStore(pool as never);
    const goal = await store.addGoal(1, { title: "ship", priority: "high" });
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/insert into goals/i);
    expect(params).toEqual([1, "ship", "high", null, null]);
    expect(goal).toEqual({ id: 7, user_id: 1, title: "ship", status: "open", priority: "high" });
  });

  it("updateGoal is scoped to the owner and coalesces partial fields", async () => {
    const pool = fakePool([]);
    const store = createStore(pool as never);
    const result = await store.updateGoal(1, 7, { status: "done" });
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/update goals set/i);
    expect(String(sql)).toMatch(/user_id = \$2/);
    expect(params).toEqual([7, 1, null, "done", null]);
    expect(result).toBeNull();
  });

  it("deleteGoal only removes the caller's own goal", async () => {
    const pool = { query: vi.fn(async (..._args: unknown[]) => ({ rows: [] as unknown[], rowCount: 1 })) };
    const store = createStore(pool as never);
    expect(await store.deleteGoal(1, 7)).toBe(true);
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/delete from goals where id = \$1 and user_id = \$2/i);
    expect(params).toEqual([7, 1]);
  });

  it("getUserByUsername binds the username and returns null when absent", async () => {
    const pool = fakePool([]);
    const store = createStore(pool as never);
    expect(await store.getUserByUsername("alice")).toBeNull();
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/from users where username = \$1/i);
    expect(params).toEqual(["alice"]);
  });
});

describe("threads", () => {
  it("initSchema creates both thread tables", async () => {
    const pool = fakePool();
    const store = createStore(pool as never);
    await store.initSchema();
    const sql = pool.query.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).toMatch(/create table if not exists threads/i);
    expect(sql).toMatch(/create table if not exists thread_messages/i);
  });

  it("createThread binds the title rather than interpolating it", async () => {
    const pool = fakePool([{ id: 7 }]);
    const store = createStore(pool as never);
    await store.createThread(1, "o'brien's idea", "/repos/app");
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).not.toContain("o'brien");
    expect(params).toEqual([1, "o'brien's idea", "/repos/app"]);
  });

  it("addThreadMessage stores mentions and hop", async () => {
    const pool = fakePool([{ id: 3 }]);
    const store = createStore(pool as never);
    await store.addThreadMessage(7, { author: "claude", body: "ask @codex", mentions: ["codex"], hop: 1 });
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/insert into thread_messages/i);
    expect(params).toEqual([7, "claude", "ask @codex", ["codex"], 1]);
  });

  it("getThread scopes the lookup to the owner", async () => {
    const pool = fakePool([]);
    const store = createStore(pool as never);
    await store.getThread(1, 7);
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/user_id = \$1/);
    expect(params).toEqual([1, 7]);
  });

  it("getThreadById does not scope by owner, for the loop's own bookkeeping", async () => {
    const pool = fakePool([]);
    const store = createStore(pool as never);
    await store.getThreadById(7);
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).not.toMatch(/user_id = /);
    expect(params).toEqual([7]);
  });

  it("hasRunningThread asks only for this operator's running threads", async () => {
    const pool = fakePool([{ id: 2 }]);
    const store = createStore(pool as never);
    expect(await store.hasRunningThread(1)).toBe(true);
    const [sql, params] = pool.query.mock.calls.at(-1)!;
    expect(String(sql)).toMatch(/status = 'running'/);
    expect(params).toEqual([1]);
  });
});
