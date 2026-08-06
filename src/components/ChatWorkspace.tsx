"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "./hooks/useChat";
import { useVoice } from "./hooks/useVoice";
import { BACKEND_OPTIONS, optionFor, type Backend } from "./agents";

export function ChatWorkspace({
  conversationId,
  backend,
  model,
}: {
  conversationId: string;
  backend?: string;
  model?: string;
}) {
  const [sel, setSel] = useState(() => optionFor(backend as Backend | undefined, model));
  const { messages, send, status } = useChat(conversationId, sel.backend, sel.model);
  const [draft, setDraft] = useState("");
  const { state: voiceState, speaking, startRecording, stopRecording, speak, stopSpeaking } = useVoice();
  const [voiceOn, setVoiceOn] = useState(false);
  const spokenRef = useRef<string>("");

  // Speak each assistant reply once it finishes streaming (voice mode only).
  useEffect(() => {
    if (!voiceOn || status !== "idle" || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === "assistant" && last.content && last.content !== spokenRef.current) {
      spokenRef.current = last.content;
      void speak(last.content);
    }
  }, [messages, status, voiceOn, speak]);

  // Tap-to-talk: first tap records, second tap transcribes and sends.
  async function onMic() {
    if (voiceState === "recording") {
      const text = await stopRecording();
      if (text) void send(text);
    } else if (voiceState === "idle") {
      if (speaking) stopSpeaking();
      await startRecording();
    }
  }

  const micLabel =
    voiceState === "recording" ? "◉ Listening — tap to send"
    : voiceState === "transcribing" ? "… transcribing"
    : speaking ? "🔊 Speaking — tap to interrupt"
    : "🎙 Tap to talk";

  const offlineHint =
    sel.backend === "claude"
      ? "Claude CLI unavailable — check `claude` is installed and logged in."
      : sel.backend === "codex"
        ? "Codex CLI unavailable — check `codex` is installed and logged in."
        : sel.backend === "opencode"
          ? "OpenClaw unavailable — check `opencode` is installed and configured."
          : sel.backend === "gemini"
            ? "Gemini not logged in — run `gemini` once and sign in with Google."
            : "Local model offline — run `ollama serve`.";

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
        <div className="mb-2 flex items-center gap-2">
          <span className="eyebrow">Model</span>
          <select
            value={sel.id}
            onChange={(e) => setSel(BACKEND_OPTIONS.find((o) => o.id === e.target.value) ?? sel)}
            disabled={status === "streaming"}
            className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-cyan-400/60 disabled:opacity-50"
          >
            {BACKEND_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} className="bg-neutral-900">
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onMic}
            disabled={voiceState === "transcribing" || status === "streaming"}
            className={`ml-auto rounded-md border px-2 py-1 text-xs transition disabled:opacity-50 ${
              voiceState === "recording"
                ? "border-red-400/70 bg-red-500/20 text-red-200"
                : "border-white/15 bg-black/40 text-neutral-200 hover:border-cyan-400/60"
            }`}
          >
            {micLabel}
          </button>
          <button
            type="button"
            onClick={() => setVoiceOn((v) => !v)}
            title="Speak assistant replies aloud"
            className={`rounded-md border px-2 py-1 text-xs transition ${
              voiceOn
                ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100"
                : "border-white/15 bg-black/40 text-neutral-400 hover:border-cyan-400/60"
            }`}
          >
            {voiceOn ? "Voice ON" : "Voice OFF"}
          </button>
        </div>
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
