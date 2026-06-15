import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/ghost", () => ({ getStore: vi.fn() }));
vi.mock("@/lib/notes", () => ({ appendTurn: vi.fn(async () => {}) }));
import { getStore } from "@/lib/ghost";
import { appendTurn } from "@/lib/notes";
import { POST } from "./route";

afterEach(() => vi.restoreAllMocks());

function req(body: unknown): Request {
  return new Request("http://test/api/memory", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/memory", () => {
  it("writes the note even when Ghost insert fails", async () => {
    (getStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      insertMessage: vi.fn(async () => { throw new Error("db down"); }),
    });
    const res = await POST(req({
      conversationId: "c1", role: "user", content: "hi",
    }));
    expect(res.status).toBe(200);
    expect(appendTurn).toHaveBeenCalledWith(expect.any(String), "c1", "user", "hi");
    const json = await res.json();
    expect(json.ghost).toBe(false);
    expect(json.notes).toBe(true);
  });

  it("returns 400 on missing fields", async () => {
    const res = await POST(req({ role: "user" }));
    expect(res.status).toBe(400);
  });
});
