"use client";
import { useState, type FormEvent } from "react";
import { useChat } from "./hooks/useChat";

export function ChatWorkspace({ conversationId }: { conversationId: string }) {
  const { messages, send, status } = useChat(conversationId);
  const [draft, setDraft] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void send(text);
  }

  return (
    <section className="flex h-full flex-col">
      {status === "offline" && (
        <div className="bg-amber-900/40 px-4 py-2 text-sm text-amber-200">
          Local model offline — run <code>ollama serve</code> (model <code>gpt-oss:20b</code>).
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className="inline-block rounded-lg bg-neutral-800 px-3 py-2 text-sm">
              {m.content}
            </span>
          </div>
        ))}
      </div>
      <form data-testid="composer" onSubmit={onSubmit} className="border-t border-neutral-800 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the local model…"
          disabled={status === "streaming"}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
      </form>
    </section>
  );
}
