"use client";
import { useCallback, useState } from "react";

export type Msg = { role: "user" | "assistant"; content: string };
export type ChatStatus = "idle" | "streaming" | "offline";

async function persist(conversationId: string, role: string, content: string) {
  try {
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, role, content }),
    });
  } catch { /* non-fatal */ }
}

export function useChat(conversationId: string) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");

  const send = useCallback(
    async (text: string) => {
      const userMsg: Msg = { role: "user", content: text };
      const history = [...messages, userMsg];
      setMessages(history);
      void persist(conversationId, "user", text);
      setStatus("streaming");

      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
      } catch {
        setStatus("offline");
        return;
      }
      if (!res.ok || !res.body) {
        setStatus("offline");
        return;
      }

      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      void persist(conversationId, "assistant", acc);
      setStatus("idle");
    },
    [messages, conversationId],
  );

  return { messages, send, status };
}
