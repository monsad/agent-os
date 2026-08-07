"use client";
import { useEffect, useState } from "react";
import { CLI_ROSTER } from "@/lib/roster";

type Variant = { id: string; name: string; ok: boolean; diff: string; error?: string };

// Derived, not restated: the checkboxes offer exactly the agents the API will
// actually run, so the two can't drift apart.
const AGENT_OPTIONS = CLI_ROSTER.map((a) => ({ id: a.id, label: a.name }));

function DiffLine({ line }: { line: string }) {
  const color =
    line.startsWith("+") && !line.startsWith("+++") ? "text-emerald-400"
    : line.startsWith("-") && !line.startsWith("---") ? "text-red-400"
    : line.startsWith("@@") ? "text-cyan-400"
    : "text-neutral-400";
  return <div className={color}>{line || " "}</div>;
}

function DiffView({ diff }: { diff: string }) {
  if (!diff.trim()) return <p className="text-xs text-neutral-500">No changes.</p>;
  return (
    <pre className="mono max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-[12px] leading-relaxed">
      {diff.split("\n").map((line, i) => (
        <DiffLine key={i} line={line} />
      ))}
    </pre>
  );
}

export function VariantsView() {
  const [repo, setRepo] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [agents, setAgents] = useState<string[]>(AGENT_OPTIONS.map((a) => a.id));
  const [busy, setBusy] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/repo").then((r) => r.json()).then((d) => setRepo(d.repoPath ?? null)).catch(() => {});
  }, []);

  function toggleAgent(id: string) {
    setAgents((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  async function runVariants() {
    if (!task.trim() || !repo || agents.length === 0) return;
    setBusy(true);
    setErr(null);
    setApplied(null);
    setVariants(null);
    setBatchId(null);
    try {
      const res = await fetch("/api/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, agents }),
      });
      const d = await res.json();
      if (res.ok) {
        setBatchId(d.batchId);
        setVariants(d.variants);
      } else {
        setErr(d.error === "no_repo" ? "Attach a repository first (Broad Opinion tab)." : d.error ?? "failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function useVariant(winnerId: string) {
    if (!batchId) return;
    setApplying(winnerId);
    setErr(null);
    try {
      const res = await fetch("/api/variants/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, winnerId }),
      });
      const d = await res.json();
      if (res.ok) {
        setApplied(winnerId);
        setVariants(null);
        setBatchId(null);
      } else {
        setErr(d.error ?? "apply failed — the winning diff may conflict with local changes");
      }
    } finally {
      setApplying(null);
    }
  }

  async function discardAll() {
    if (!batchId) return;
    setDiscarding(true);
    setErr(null);
    try {
      await fetch("/api/variants/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      setVariants(null);
      setBatchId(null);
    } finally {
      setDiscarding(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="panel rounded-2xl p-5">
        <p className="eyebrow mb-2">Run competing variants</p>
        {repo ? (
          <p className="mono mb-3 text-sm text-emerald-300/90">✓ {repo}</p>
        ) : (
          <p className="mb-3 text-sm text-neutral-400">No repo attached — attach one in the Broad Opinion tab.</p>
        )}
        <p className="mb-3 text-sm text-neutral-400">
          One task, every agent writing in its own isolated worktree — nothing touches the real repo until
          you pick a winner. Losers are discarded, not merged.
        </p>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe the change… e.g. 'Add a loading spinner to the goals list while it fetches.'"
          rows={3}
          disabled={busy}
          className="w-full resize-y rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none transition focus:border-cyan-400/70 focus:bg-black/45 disabled:opacity-50"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {AGENT_OPTIONS.map((a) => (
            <label key={a.id} className="flex items-center gap-1.5 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={agents.includes(a.id)}
                onChange={() => toggleAgent(a.id)}
                disabled={busy}
                className="accent-cyan-400"
              />
              {a.label}
            </label>
          ))}
        </div>
        <div className="mt-3">
          <button
            onClick={runVariants}
            disabled={!repo || busy || !task.trim() || agents.length === 0}
            className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 px-5 py-2.5 text-sm font-medium text-black/80 disabled:opacity-40"
          >
            {busy ? "Running…" : "Run variants"}
          </button>
        </div>
        {err && <p className="mt-3 text-sm text-amber-300">{err}</p>}
        {applied && <p className="mt-3 text-sm text-emerald-300">✓ Applied {applied}&apos;s changes to the repo.</p>}
      </div>

      {busy && (
        <p className="mono text-xs text-neutral-500">
          {agents.length} agent(s) writing in isolated worktrees… this can take several minutes.
        </p>
      )}

      {variants && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {variants.map((v) => (
              <div key={v.id} className="panel rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${v.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <h3 className="text-sm text-neutral-100">{v.name}</h3>
                  <span className="eyebrow ml-auto">variant</span>
                </div>
                {v.ok ? (
                  <>
                    <DiffView diff={v.diff} />
                    <button
                      onClick={() => useVariant(v.id)}
                      disabled={applying !== null || discarding || !v.diff.trim()}
                      className="mt-3 rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-40"
                    >
                      {applying === v.id ? "Applying…" : "Use this"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-amber-300">{v.error ?? "failed"}</p>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={discardAll}
            disabled={applying !== null || discarding}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5 disabled:opacity-40"
          >
            {discarding ? "Discarding…" : "Discard all"}
          </button>
        </>
      )}
    </div>
  );
}
