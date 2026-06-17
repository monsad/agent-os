"use client";
import { useState, type FormEvent } from "react";
import { useChat } from "./hooks/useChat";

export function ChatWorkspace({
  conversationId,
  backend,
  model,
}: {
  conversationId: string;
  backend?: string;
  model?: string;
}) {
  const { messages, send, status } = useChat(conversationId, backend, model);
  const [draft, setDraft] = useState("");

  const offlineHint =
    backend === "claude"
      ? "Claude CLI unavailable — check `claude` is installed and logged in."
      : backend === "codex"
        ? "Codex CLI unavailable — check `codex` is installed and logged in."
        : backend === "opencode"
          ? "OpenClaw unavailable — check `opencode` is installed and configured."
          : backend === "gemini"
            ? "Gemini not logged in — run `gemini` once and sign in with Google."
            : "Local model offline — run `ollama serve` (model `qwen2.5:14b`).";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void send(text);
  }

  const waiting =
    status === "streaming" && (messages.length === 0 || messages[messages.length - 1].content === "");

  return (
    <section className="flex h-full flex-col">
      {status === "offline" && (
        <div className="bg-amber-900/40 px-4 py-2 text-sm text-amber-200">{offlineHint}</div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "bg-indigo-500/20 text-indigo-100" : "bg-white/[0.05] text-neutral-200"
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        {waiting && <p className="mono text-xs text-neutral-500">thinking…</p>}
      </div>
      <form data-testid="composer" onSubmit={onSubmit} className="border-t border-white/[0.06] p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the agent…"
          disabled={status === "streaming"}
          className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400/70 focus:bg-black/45 disabled:opacity-50"
        />
      </form>
    </section>
  );
}
