import { streamChat, type ChatMessage } from "@/lib/ollama";

export async function POST(request: Request): Promise<Response> {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const iterator = streamChat(body.messages)[Symbol.asyncIterator]();

  // Probe the first chunk so upstream failures surface as a 503, not a broken stream.
  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch {
    return Response.json({ error: "ollama_unavailable" }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        let next = await iterator.next();
        while (!next.done) {
          controller.enqueue(encoder.encode(next.value));
          next = await iterator.next();
        }
      } catch {
        // truncate the stream; client already has partial content
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
