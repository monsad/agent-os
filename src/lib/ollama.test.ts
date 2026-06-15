import { describe, it, expect, vi, afterEach } from "vitest";
import { streamChat, type ChatMessage } from "./ollama";

function sseResponse(chunks: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

afterEach(() => vi.restoreAllMocks());

describe("streamChat", () => {
  it("yields content deltas in order", async () => {
    const msgs: ChatMessage[] = [{ role: "user", content: "hi" }];
    vi.stubGlobal("fetch", vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"content":"He"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    ));
    const out: string[] = [];
    for await (const tok of streamChat(msgs)) out.push(tok);
    expect(out.join("")).toBe("Hello");
  });

  it("throws a typed error when the upstream is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const gen = streamChat([{ role: "user", content: "hi" }]);
    await expect(gen.next()).rejects.toThrow(/Ollama/);
  });
});
