import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "./useChat";

function streamBody(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("useChat", () => {
  it("appends user + assistant messages from the stream", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/api/chat")) {
        return new Response(streamBody("Hello"), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));

    const { result } = renderHook(() => useChat("conv-test"));
    await act(async () => { await result.current.send("hi"); });

    await waitFor(() => {
      expect(result.current.messages.at(-1)).toEqual({
        role: "assistant", content: "Hello",
      });
    });
    expect(result.current.messages[0]).toEqual({ role: "user", content: "hi" });
  });

  it("sets status offline on a 503", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    const { result } = renderHook(() => useChat("conv-test"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => expect(result.current.status).toBe("offline"));
  });
});
