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
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/repo").then((r) => r.json()).then((d) => setRepo(d.repoPath ?? null)).catch(() => {});
  }, []);

  async function uploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(list).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (res.ok) {
        setRepo(d.dir);
        setUploaded((prev) => [...new Set([...prev, ...d.saved])]);
      } else {
        setErr(d.error ?? "upload failed");
      }
    } finally {
      setUploading(false);
    }
  }

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
          <p className="mono mb-1 text-sm text-emerald-300/90">✓ {repo}</p>
        ) : (
          <p className="mb-1 text-sm text-neutral-400">No repo attached yet.</p>
        )}
        <p className="mb-2 text-xs text-neutral-400">Type a local path or git URL below, then press Attach to change it.</p>
        <form onSubmit={attachRepo} className="flex gap-2">
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="~/my-project  or  https://github.com/owner/repo"
            className="mono flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400/70 focus:bg-black/45"
          />
          <button
            type="submit"
            className="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-5 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/25"
          >
            Attach
          </button>
        </form>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs text-neutral-400">…or add files from your computer (agents read them as context):</p>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void uploadFiles(e.dataTransfer.files);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/25 bg-black/20 px-4 py-6 text-center transition hover:border-cyan-400/60 hover:bg-black/30"
          >
            <span className="text-2xl text-cyan-300/70">⤓</span>
            <span className="text-sm text-neutral-200">{uploading ? "Uploading…" : "Drop files here or click to browse"}</span>
            <span className="text-xs text-neutral-500">code, docs, notes, any text files</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void uploadFiles(e.target.files)}
            />
          </label>
          {uploaded.length > 0 && (
            <p className="mono mt-2 text-xs text-emerald-300/80">✓ {uploaded.length} file(s): {uploaded.join(", ")}</p>
          )}
        </div>
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
            className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400/70 focus:bg-black/45 disabled:opacity-50"
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
