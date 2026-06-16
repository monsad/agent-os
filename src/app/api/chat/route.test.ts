import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/ollama", () => ({
  streamChat: vi.fn(),
}));
vi.mock("@/lib/cliAgent", () => ({
  runCliAgent: vi.fn(),
}));
import { streamChat } from "@/lib/ollama";
import { runCliAgent } from "@/lib/cliAgent";
import { POST } from "./route";

afterEach(() => vi.restoreAllMocks());

function req(body: unknown): Request {
  return new Request("http://test/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/chat", () => {
  it("streams concatenated deltas", async () => {
    (streamChat as unknown as ReturnType<typeof vi.fn>).mockImplementation(async function* () {
      yield "Hel"; yield "lo";
    });
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello");
  });

  it("returns 400 when messages are missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 503 when Ollama throws", async () => {
    (streamChat as unknown as ReturnType<typeof vi.fn>).mockImplementation(async function* () {
      throw new Error("Ollama request failed: 500");
    });
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(503);
  });

  it("routes to the CLI agent and returns its answer for backend=claude", async () => {
    (runCliAgent as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("hi from claude");
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }], backend: "claude" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hi from claude");
    expect(runCliAgent).toHaveBeenCalledWith("claude", [{ role: "user", content: "hi" }]);
  });

  it("returns 503 when the CLI agent throws", async () => {
    (runCliAgent as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("not found"));
    const res = await POST(req({ messages: [{ role: "user", content: "hi" }], backend: "codex" }));
    expect(res.status).toBe(503);
  });
});
