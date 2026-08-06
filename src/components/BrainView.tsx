"use client";
import { useEffect, useState } from "react";

type Status = {
  initialized: boolean;
  raw?: number;
  atoms?: number;
  threads?: number;
  briefings?: number;
  latestBriefing?: string | null;
  latestBriefingName?: string | null;
};

export function BrainView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  // Recall: question in, cited answer out — read-only, atoms/threads only.
  async function ask() {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/brain/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const d = await res.json();
      setAnswer(res.ok ? d.answer : d.error ?? "ask failed");
    } catch {
      setAnswer("ask failed — is the dev server running?");
    } finally {
      setAsking(false);
    }
  }

  function refresh() {
    fetch("/api/brain").then((r) => r.json()).then(setStatus).catch(() => {});
  }
  useEffect(refresh, []);

  async function post(body: object) {
    return fetch("/api/brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }

  async function capture() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const d = await post({ action: "capture", text: draft });
      setStatus(d);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("target", "brain");
      Array.from(list).forEach((f) => fd.append("files", f));
      await fetch("/api/upload", { method: "POST", body: fd });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runShift() {
    setRunning(true);
    setErr(null);
    setSummary(null);
    try {
      const res = await fetch("/api/brain/refine", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setSummary(d.summary);
        setStatus(d);
      } else {
        setErr(d.error === "empty_raw" ? "Nothing in intake — capture a thought or add files first." : d.error ?? "failed");
      }
    } finally {
      setRunning(false);
    }
  }

  const stat = (label: string, value: number | undefined) => (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
      <p className="text-lg text-neutral-100">{value ?? 0}</p>
      <p className="eyebrow mt-0.5">{label}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="panel rounded-2xl p-5">
        <p className="eyebrow mb-1">Night shift · second brain</p>
        <p className="mb-3 text-sm text-neutral-400">
          Drop raw thoughts in. Claude refines them into linked atomic notes, flags contradictions,
          and writes you a briefing — read-only on your sources, version-controlled.
        </p>
        {status && status.initialized && (
          <div className="grid grid-cols-4 gap-2">
            {stat("Intake", status.raw)}
            {stat("Atoms", status.atoms)}
            {stat("Threads", status.threads)}
            {stat("Briefings", status.briefings)}
          </div>
        )}
      </div>

      <div className="panel rounded-2xl p-5">
        <p className="eyebrow mb-2">Capture a raw thought</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Dump a half-formed idea, a quote, a link… one or many. The night shift sorts it out."
          rows={3}
          className="w-full resize-y rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400/70 focus:bg-black/45"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={capture}
            disabled={busy || !draft.trim()}
            className="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-40"
          >
            Add to intake
          </button>
          <label className="cursor-pointer rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5">
            …or add files
            <input type="file" multiple className="hidden" onChange={(e) => void uploadFiles(e.target.files)} />
          </label>
        </div>
      </div>

      <div className="panel rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow mb-1">Run the night shift</p>
            <p className="text-sm text-neutral-400">Processes everything in intake into atoms + a briefing.</p>
          </div>
          <button
            onClick={runShift}
            disabled={running}
            className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 px-5 py-2.5 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            {running ? "Working…" : "Run night shift"}
          </button>
        </div>
        {running && <p className="mono mt-3 text-xs text-neutral-500">Claude is refining intake → atoms… this can take a few minutes.</p>}
        {err && <p className="mt-3 text-sm text-amber-300">{err}</p>}
        {summary && <p className="mt-3 rounded-lg bg-black/20 p-3 text-sm text-neutral-200">{summary}</p>}
      </div>

      <div className="panel rounded-2xl p-5">
        <p className="eyebrow mb-2">Ask your brain</p>
        <p className="mb-2 text-sm text-neutral-400">
          Answers come only from your atoms — every claim cites its note. No notes, no answer.
        </p>
        <div className="flex items-center gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void ask(); }}
            placeholder="What do I believe about…?"
            disabled={asking}
            className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400/70 focus:bg-black/45 disabled:opacity-50"
          />
          <button
            onClick={() => void ask()}
            disabled={asking || !question.trim()}
            className="shrink-0 rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-40"
          >
            {asking ? "Recalling…" : "Ask"}
          </button>
        </div>
        {asking && <p className="mono mt-3 text-xs text-neutral-500">Searching atoms + threads…</p>}
        {answer && (
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-[13px] leading-relaxed text-neutral-200">
            {answer}
          </pre>
        )}
      </div>

      {status?.latestBriefing && (
        <div className="panel rounded-2xl p-5">
          <p className="eyebrow mb-2">Latest briefing · {status.latestBriefingName}</p>
          <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-neutral-300">
            {status.latestBriefing}
          </pre>
        </div>
      )}
    </div>
  );
}
