import { describe, it, expect } from "vitest";
import { readJson, invalidJson } from "./http";

function jsonReq(raw: string): Request {
  return new Request("http://test", {
    method: "POST",
    body: raw,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readJson", () => {
  it("returns the parsed body", async () => {
    const body = await readJson<{ task?: string }>(jsonReq(JSON.stringify({ task: "ship it" })));
    expect(body?.task).toBe("ship it");
  });

  it("returns null for malformed JSON instead of throwing", async () => {
    expect(await readJson(jsonReq("{not json"))).toBeNull();
  });

  it("returns null for an empty body", async () => {
    expect(await readJson(new Request("http://test", { method: "POST" }))).toBeNull();
  });

  // Otherwise `if (!body)` would pass a null through to code expecting an object.
  it("treats a literal null body as unusable", async () => {
    expect(await readJson(jsonReq("null"))).toBeNull();
  });
});

describe("invalidJson", () => {
  it("is a 400 carrying the shared error shape", async () => {
    const res = invalidJson();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid json");
  });
});
