import { streamChat, type ChatMessage } from "@/lib/ollama";
import { runCliAgent, type CliBackend } from "@/lib/cliAgent";

type Backend = "ollama" | CliBackend;

export async function POST(request: Request): Promise<Response> {
  let body: { messages?: ChatMessage[]; backend?: Backend; model?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const backend: Backend = body.backend ?? "ollama";

  // Subscription / local CLI agents: run the local CLI, return the full answer.
  if (backend === "claude" || backend === "codex" || backend === "opencode" || backend === "gemini") {
    try {
      const answer = await runCliAgent(backend, body.messages);
      return new Response(answer, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } catch {
      return Response.json({ error: `${backend}_unavailable` }, { status: 503 });
    }
  }

  // Local Ollama: stream tokens (optional per-agent model override).
  const iterator = streamChat(body.messages, body.model)[Symbol.asyncIterator]();

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
