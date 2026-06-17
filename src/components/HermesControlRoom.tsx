"use client";
import { useEffect, useState } from "react";

const TABS = [
  { id: "status", label: "Status", cmd: "status" },
  { id: "skills", label: "Skills", cmd: "skills" },
  { id: "kanban", label: "Kanban", cmd: "kanban-stats" },
  { id: "plugins", label: "Plugins", cmd: "plugins" },
] as const;

export function HermesControlRoom() {
  const [tab, setTab] = useState<string>("status");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const cmd = TABS.find((t) => t.id === tab)?.cmd;
    if (!cmd) return;
    setLoading(true);
    setErr(null);
    fetch("/api/hermes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd }),
    })
      .then((r) => r.json())
      .then((d) => (d.output != null ? setOutput(d.output) : setErr(d.error ?? "failed")))
      .catch(() => setErr("hermes unreachable"))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-white/[0.06] px-4 py-2 text-xs">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 transition ${tab === t.id ? "bg-white/[0.07] text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading && <p className="mono text-xs text-neutral-500">running hermes {tab}…</p>}
        {err && (
          <p className="text-sm text-amber-300">
            {err.includes("not found") ? "Hermes CLI not found on PATH." : err}
          </p>
        )}
        {!loading && !err && output && (
          <pre className="mono whitespace-pre overflow-x-auto text-[12px] leading-relaxed text-neutral-300">
            {output.trim()}
          </pre>
        )}
        {!loading && !err && !output && <p className="text-sm text-neutral-500">No output.</p>}
      </div>
    </div>
  );
}
