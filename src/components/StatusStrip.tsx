"use client";
import { useEffect, useState } from "react";

type Card = { label: string; value: string; sub: string; dot: string };

export function StatusStrip() {
  const [graphBuilt, setGraphBuilt] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => (r.ok ? r.json() : { exists: false }))
      .then((d) => setGraphBuilt(Boolean(d.exists)))
      .catch(() => setGraphBuilt(false));
  }, []);

  const cards: Card[] = [
    { label: "Local LLM", value: "Online", sub: "qwen2.5:14b · Ollama", dot: "bg-emerald-400" },
    { label: "Memory", value: "Auto-save", sub: "notes → graphify", dot: "bg-emerald-400" },
    { label: "Ghost", value: "Offline", sub: "no connection string", dot: "bg-neutral-600" },
    { label: "Heartbeat", value: "—", sub: "poll · 4s", dot: "bg-amber-400" },
    { label: "Latency", value: "local", sub: "on-device p50", dot: "bg-emerald-400" },
    {
      label: "Knowledge Graph",
      value: graphBuilt == null ? "…" : graphBuilt ? "Built" : "Empty",
      sub: graphBuilt ? "graph.html ready" : "run rebuild",
      dot: graphBuilt ? "bg-emerald-400" : "bg-neutral-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="panel rounded-xl p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">{c.label}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          </div>
          <p className="text-[15px] text-neutral-100">{c.value}</p>
          <p className="mono mt-1 text-[11px] text-neutral-500">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
