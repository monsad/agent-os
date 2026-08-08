"use client";
import { useEffect, useRef, useState } from "react";
import { CLI_ROSTER } from "@/lib/roster";

type Thread = { id: number; title: string; status: "idle" | "running" | "stopped" };
type ThreadMessage = { id: number; author: string; body: string; hop: number };

const ROSTER_BY_ID = new Map(CLI_ROSTER.map((a) => [a.id, a.name]));
const MENTION_RE = new RegExp(`@(${CLI_ROSTER.map((a) => a.id).join("|")})\\b`, "i");
const HANDLES = CLI_ROSTER.map((a) => `@${a.id}`).join(", ");

function speakerName(author: string): string {
  if (author === "human") return "You";
  return ROSTER_BY_ID.get(author) ?? author;
}

export default function ThreadsView() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/threads")
      .then((r) => r.json())
      .then((d) => setThreads(d.threads ?? []))
      .catch(() => {});
  }, []);

  async function loadThread(id: number) {
    const res = await fetch(`/api/threads/${id}`);
    const d = await res.json();
    if (res.ok) {
      setThread(d.thread);
      setMessages(d.messages ?? []);
    }
  }

  useEffect(() => {
    if (threadId === null) {
      setThread(null);
      setMessages([]);
      return;
    }
    void loadThread(threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (threadId === null || thread?.status !== "running") return;
    pollRef.current = setInterval(() => void loadThread(threadId), 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, thread?.status]);

  const mentionsAgent = MENTION_RE.test(draft);

  async function send() {
    const message = draft.trim();
    if (!message || !mentionsAgent || busy) return;
    setBusy(true);
    setErr(null);
    try {
      if (threadId === null) {
        const res = await fetch("/api/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        const d = await res.json();
        if (res.ok) {
          setThreads((prev) => [...prev, d.thread]);
          setThreadId(d.thread.id);
          setDraft("");
        } else {
          setErr(errorMessage(d.error, res.status));
        }
      } else {
        const res = await fetch(`/api/threads/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        const d = await res.json();
        if (res.ok) {
          setDraft("");
          await loadThread(threadId);
        } else {
          setErr(errorMessage(d.error, res.status));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (threadId === null) return;
    setErr(null);
    const res = await fetch(`/api/threads/${threadId}/stop`, { method: "POST" });
    if (res.ok) {
      await loadThread(threadId);
    } else {
      const d = await res.json();
      setErr(errorMessage(d.error, res.status));
    }
  }

  function errorMessage(error: string | undefined, status: number): string {
    if (status === 409 || error === "thread_already_running") return "Another thread is still running — wait for it to finish.";
    if (error === "no_mentions") return "Mention an agent (e.g. @claude) so someone picks this up.";
    if (error === "no_repo") return "Attach a repository first.";
    return error ?? "failed";
  }

  const isRunning = thread?.status === "running";

  return (
    <div className="space-y-5">
      <div className="panel rounded-2xl p-5">
        <p className="eyebrow mb-2">Agent threads</p>
        <p className="mb-3 text-sm text-neutral-400">
          Post a message and hand the floor with a handle — {HANDLES} — agents read the whole thread and pass it
          along the same way.
        </p>

        {threads.length > 0 && (
          <select
            value={threadId ?? ""}
            onChange={(e) => setThreadId(e.target.value === "" ? null : Number(e.target.value))}
            className="mb-3 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-cyan-400/70 focus:bg-black/45"
          >
            <option value="">New thread…</option>
            {threads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.status})
              </option>
            ))}
          </select>
        )}

        <div className="mb-3 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
          {messages.length === 0 && <p className="text-xs text-neutral-500">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm text-neutral-100">{speakerName(m.author)}</span>
                {m.author !== "human" && <span className="eyebrow">hop {m.hop}</span>}
              </div>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-neutral-300">{m.body}</p>
            </div>
          ))}
        </div>

        {isRunning && (
          <p className="mono mb-2 text-xs text-cyan-300/80">● running — agents are handing off the floor…</p>
        )}

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Say something and mention who should pick it up, e.g. "@claude what do we think?"`}
          rows={3}
          disabled={busy}
          className="w-full resize-y rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400/70 focus:bg-black/45 disabled:opacity-50"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => void send()}
            disabled={!mentionsAgent || busy}
            className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 px-5 py-2.5 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            {busy ? "Sending…" : threadId === null ? "Start" : "Reply"}
          </button>
          {threadId !== null && isRunning && (
            <button
              onClick={() => void stop()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5"
            >
              Stop after this turn
            </button>
          )}
        </div>

        {err && <p className="mt-3 text-sm text-amber-300">{err}</p>}
      </div>
    </div>
  );
}
