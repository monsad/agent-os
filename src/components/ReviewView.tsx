"use client";
import { useEffect, useState } from "react";

type Finding = { id: string; name: string; lens: string; review: string; ok: boolean };

export function ReviewView() {
  const [repo, setRepo] = useState<string | null>(null);
  const [mode, setMode] = useState<"working" | "branch">("working");
  const [ref, setRef] = useState("main");
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    fetch("/api/repo").then((r) => r.json()).then((d) => setRepo(d.repoPath ?? null)).catch(() => {});
  }, []);

  async function runReview() {
    if (!repo) return;
    setBusy(true);
    setErr(null);
    setFindings(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ref }),
      });
      const d = await res.json();
      if (res.ok) {
        setFindings(d.findings);
        setTruncated(Boolean(d.truncated));
      } else {
        setErr(
          d.error === "no_repo" ? "Attach a repository first (Broad Opinion tab)." :
          d.error === "empty_diff" ? "No changes to review in that mode." :
          d.error ?? "review failed",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="panel rounded-2xl p-5">
        <p className="eyebrow mb-2">Code review</p>
        {repo ? (
          <p className="mono mb-3 text-sm text-emerald-300/90">✓ {repo}</p>
        ) : (
          <p className="mb-3 text-sm text-neutral-400">No repo attached — attach one in the Broad Opinion tab.</p>
        )}
        <p className="mb-3 text-sm text-neutral-400">
          Four agents review the diff, each with a different lens (bugs · security · architecture · tests). They flag —
          <span className="text-neutral-200"> you own the merge.</span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/15 p-0.5">
            <button
              onClick={() => setMode("working")}
              className={`rounded-md px-3 py-1.5 text-sm transition ${mode === "working" ? "bg-white/10 text-neutral-100" : "text-neutral-400"}`}
            >
              Working changes
            </button>
            <button
              onClick={() => setMode("branch")}
              className={`rounded-md px-3 py-1.5 text-sm transition ${mode === "branch" ? "bg-white/10 text-neutral-100" : "text-neutral-400"}`}
            >
              vs branch
            </button>
          </div>
          {mode === "branch" && (
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="main"
              className="mono w-40 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none focus:border-cyan-400/70 focus:bg-black/45"
            />
          )}
          <button
            onClick={runReview}
            disabled={!repo || busy}
            className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 px-5 py-2 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            {busy ? "Reviewing…" : "Run review"}
          </button>
        </div>
        {err && <p className="mt-3 text-sm text-amber-300">{err}</p>}
        {truncated && <p className="mt-2 text-xs text-amber-300/80">Diff was large — reviewed the first part only.</p>}
      </div>

      {busy && <p className="mono text-xs text-neutral-500">4 reviewers reading the diff… give it a minute.</p>}

      {findings && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {findings.map((f) => (
            <div key={f.id} className="panel rounded-2xl p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${f.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
                <h3 className="text-sm text-neutral-100">{f.name}</h3>
              </div>
              <p className="mb-3 text-[11px] uppercase tracking-wide text-cyan-200/40">{f.lens.split(":")[0]}</p>
              <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-neutral-300">{f.review}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
