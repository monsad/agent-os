import { describe, it, expect, vi } from "vitest";
import { createStore } from "./ghost";

function fakePool(rows: unknown[] = []) {
  return { query: vi.fn(async () => ({ rows })) };
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

  it("isAvailable returns false when the pool throws", async () => {
    const pool = { query: vi.fn(async () => { throw new Error("down"); }) };
    const store = createStore(pool as never);
    expect(await store.isAvailable()).toBe(false);
  });
});
