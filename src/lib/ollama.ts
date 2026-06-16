import { getEnv } from "./env";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function* streamChat(
  messages: ChatMessage[],
  modelOverride?: string,
): AsyncGenerator<string, void, unknown> {
  const base = getEnv("OLLAMA_BASE_URL", "http://localhost:11434/v1");
  const model = modelOverride ?? getEnv("OLLAMA_MODEL", "gpt-oss:20b");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.2 }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const delta = parseLine(line);
        if (delta === DONE) return;
        if (delta) yield delta;
      }
    }
    // Flush a trailing line if the stream closed without a [DONE] marker.
    const delta = parseLine(buffer);
    if (delta && delta !== DONE) yield delta;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

const DONE = Symbol("done");

function parseLine(line: string): string | typeof DONE | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return DONE;
  try {
    const json = JSON.parse(data);
    const delta = json?.choices?.[0]?.delta?.content;
    return typeof delta === "string" && delta.length > 0 ? delta : null;
  } catch {
    return null;
  }
}
