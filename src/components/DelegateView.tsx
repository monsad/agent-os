"use client";
import { useEffect, useState } from "react";

type Proposal = { id: string; name: string; answer: string; ok: boolean };

export function DelegateView() {
  const [repo, setRepo] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/repo").then((r) => r.json()).then((d) => setRepo(d.repoPath ?? null)).catch(() => {});
  }, []);

  async function delegate() {
    if (!task.trim() || !repo) return;
    setBusy(true);
    setErr(null);
    setProposals(null);
    setTaskId(null);
    try {
      const res = await fetch("/api/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const d = await res.json();
      if (res.ok) {
        setProposals(d.proposals);
        setTaskId(d.taskId ?? null);
      } else {
        setErr(d.error === "no_repo" ? "Attach a repository first (Broad Opinion tab)." : d.error ?? "failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="panel rounded-2xl p-5">
        <p className="eyebrow mb-2">Delegate one task to the whole team</p>
        {repo ? (
          <p className="mono mb-3 text-sm text-emerald-300/90">✓ {repo}</p>
        ) : (
          <p className="mb-3 text-sm text-neutral-400">No repo attached — attach one in the Broad Opinion tab.</p>
        )}
        <p className="mb-3 text-sm text-neutral-400">
          Pass the task once → it&apos;s logged on the Hermes kanban (tracked) and every agent reads the
          repo and proposes its own solution. They flag —<span className="text-neutral-200"> you decide.</span>
        </p>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe the task once… e.g. 'Add rate limiting to the /query endpoint and explain how.'"
          rows={3}
          disabled={busy}
          className="w-full resize-y rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400/70 focus:bg-black/45 disabled:opacity-50"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={delegate}
            disabled={!repo || busy || !task.trim()}
            className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 px-5 py-2.5 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            {busy ? "Delegating…" : "Delegate task"}
          </button>
          {taskId && <span className="mono text-xs text-emerald-300/80">kanban: {taskId}</span>}
        </div>
        {err && <p className="mt-3 text-sm text-amber-300">{err}</p>}
      </div>

      {busy && <p className="mono text-xs text-neutral-500">logging the task + 4 agents proposing from the repo… give it a minute.</p>}

      {proposals && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {proposals.map((p) => (
            <div key={p.id} className="panel rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${p.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
                <h3 className="text-sm text-neutral-100">{p.name}</h3>
                <span className="eyebrow ml-auto">proposal</span>
              </div>
              <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-neutral-300">{p.answer}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
