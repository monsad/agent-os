"use client";
import { useEffect, useState, type FormEvent } from "react";

type Opinion = { id: string; name: string; answer: string; ok: boolean };

export function CouncilView() {
  const [repo, setRepo] = useState<string | null>(null);
  const [repoInput, setRepoInput] = useState("");
  const [question, setQuestion] = useState("");
  const [opinions, setOpinions] = useState<Opinion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/repo").then((r) => r.json()).then((d) => setRepo(d.repoPath ?? null)).catch(() => {});
  }, []);

  async function attachRepo(e: FormEvent) {
    e.preventDefault();
    const value = repoInput.trim();
    if (!value) return;
    setErr(null);
    const isUrl = /^https?:\/\/|^git@/.test(value);
    const res = await fetch("/api/repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isUrl ? { url: value } : { path: value }),
    });
    const d = await res.json();
    if (res.ok) {
      setRepo(d.repoPath);
      setRepoInput("");
    } else {
      setErr(d.error ?? "could not attach repo");
    }
  }

  async function askCouncil(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || !repo) return;
    setBusy(true);
    setOpinions(null);
    setErr(null);
    try {
      const res = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const d = await res.json();
      if (res.ok) setOpinions(d.opinions);
      else setErr(d.error === "no_repo" ? "Attach a repository first." : d.error ?? "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="panel rounded-2xl p-5">
        <p className="eyebrow mb-2">Repository</p>
        {repo ? (
          <p className="mono mb-3 text-sm text-emerald-300/90">✓ {repo}</p>
        ) : (
          <p className="mb-3 text-sm text-neutral-400">No repo attached. Paste a local path or a git URL.</p>
        )}
        <form onSubmit={attachRepo} className="flex gap-2">
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="~/my-project  or  https://github.com/owner/repo"
            className="mono flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-sm outline-none"
          />
          <button type="submit" className="panel panel-hover rounded-lg px-4 py-2 text-sm">Attach</button>
        </form>
      </div>

      <div className="panel rounded-2xl p-5">
        <p className="eyebrow mb-2">Broad opinion</p>
        <p className="mb-3 text-sm text-neutral-400">
          Ask once — every file-capable agent answers from inside the repo (read-only).
        </p>
        <form onSubmit={askCouncil} className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Where are the biggest risks in this codebase?"
            disabled={!repo || busy}
            className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!repo || busy}
            className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 px-4 py-2 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            {busy ? "Consulting…" : "Get opinion"}
          </button>
        </form>
        {err && <p className="mt-3 text-sm text-amber-300">{err}</p>}
      </div>

      {busy && <p className="mono text-xs text-neutral-500">4 agents reading the repo… this can take a minute.</p>}

      {opinions && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {opinions.map((o) => (
            <div key={o.id} className="panel rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${o.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
                <h3 className="text-sm text-neutral-100">{o.name}</h3>
              </div>
              <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-neutral-300">
                {o.answer}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
