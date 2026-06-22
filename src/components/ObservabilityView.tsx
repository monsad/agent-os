"use client";
import { useEffect, useState } from "react";

type AgentStat = { agent: string; runs: number; okRate: number; timeouts: number; avgMs: number; p95Ms: number };
type Run = { ts: number; feature: string; agent: string; durationMs: number; status: string; task: string };
type Batch = { batchId: string; feature: string; task: string; rows: { agent: string; durationMs: number; status: string }[] };
type Data = { total: number; agents: AgentStat[]; recent: Run[]; batches: Batch[] };

const dur = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
const ago = (ts: number) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};
const dot = (st: string) => (st === "ok" ? "bg-emerald-400" : st === "timeout" ? "bg-amber-400" : "bg-red-400");

export function ObservabilityView() {
  const [d, setD] = useState<Data | null>(null);

  function load() {
    fetch("/api/observability").then((r) => r.json()).then(setD).catch(() => {});
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!d) return <p className="mono text-xs text-neutral-500">loading…</p>;
  if (d.total === 0)
    return (
      <div className="panel rounded-2xl p-6 text-sm text-neutral-400">
        No runs yet. Use Broad Opinion, Delegate, Code Review or chat — every agent run is logged here
        (duration · success · head-to-head).
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-3">Per-agent — {d.total} runs logged</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.agents.map((a) => (
            <div key={a.agent} className="panel rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm text-neutral-100">{a.agent}</h3>
                <span className="mono text-[11px] text-neutral-500">{a.runs} runs</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Stat label="Success" value={`${a.okRate}%`} good={a.okRate >= 80} />
                <Stat label="Avg" value={dur(a.avgMs)} />
                <Stat label="p95" value={dur(a.p95Ms)} />
                <Stat label="Timeouts" value={String(a.timeouts)} good={a.timeouts === 0} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {d.batches.length > 0 && (
        <div>
          <p className="eyebrow mb-3">Head-to-head — same task, every agent</p>
          <div className="space-y-3">
            {d.batches.map((b) => (
              <div key={b.batchId} className="panel rounded-2xl p-4">
                <p className="mb-2 text-[13px] text-neutral-300">
                  <span className="mono text-[10px] uppercase tracking-wide text-cyan-200/50">{b.feature}</span>{" "}
                  {b.task}
                </p>
                <div className="flex flex-wrap gap-2">
                  {b.rows.map((r, i) => (
                    <span
                      key={r.agent}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                        i === 0 && r.status === "ok" ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-black/20"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${dot(r.status)}`} />
                      <span className="text-neutral-200">{r.agent}</span>
                      <span className="mono text-neutral-400">{r.status === "ok" ? dur(r.durationMs) : r.status}</span>
                      {i === 0 && r.status === "ok" && <span className="text-emerald-300/80">fastest</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="eyebrow mb-3">Recent runs</p>
        <div className="panel overflow-hidden rounded-2xl">
          {d.recent.map((r, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-2 text-sm last:border-0">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot(r.status)}`} />
              <span className="w-20 shrink-0 text-neutral-200">{r.agent}</span>
              <span className="mono w-20 shrink-0 text-[11px] uppercase tracking-wide text-neutral-500">{r.feature}</span>
              <span className="flex-1 truncate text-neutral-400">{r.task}</span>
              <span className="mono shrink-0 text-xs text-neutral-300">{r.status === "ok" ? dur(r.durationMs) : r.status}</span>
              <span className="mono w-16 shrink-0 text-right text-[11px] text-neutral-600">{ago(r.ts)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <p className="eyebrow mb-0.5">{label}</p>
      <p className={`text-[15px] ${good === undefined ? "text-neutral-100" : good ? "text-emerald-300" : "text-amber-300"}`}>{value}</p>
    </div>
  );
}
