"use client";
import { useState, type FormEvent } from "react";

type Hit = { conversation_id: string; content: string };

export function GraphExplorer() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  async function onQuery(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/memory/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const json = await res.json();
      setAnswer(json.graph ?? "(no graph yet — rebuild first)");
      setHits(Array.isArray(json.messages) ? json.messages : []);
    } finally {
      setBusy(false);
    }
  }

  async function onRebuild() {
    setBusy(true);
    try {
      await fetch("/api/graph/rebuild", { method: "POST" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wide text-neutral-500">Knowledge graph</h3>
        <button onClick={onRebuild} disabled={busy} className="text-xs text-sky-400 hover:underline">
          Rebuild
        </button>
      </div>
      <iframe
        title="graph"
        src="/api/graph/html"
        sandbox="allow-scripts"
        className="h-40 w-full rounded border border-neutral-800 bg-white"
      />
      <form data-testid="graph-query" onSubmit={onQuery}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask the graph…"
          className="w-full rounded bg-neutral-900 px-2 py-1 text-sm outline-none"
        />
      </form>
      {answer && <pre className="whitespace-pre-wrap rounded bg-neutral-900 p-2 text-xs">{answer}</pre>}
      {hits.length > 0 && (
        <ul className="space-y-1">
          {hits.map((h, i) => (
            <li key={i} className="rounded bg-neutral-900 p-2 text-xs text-neutral-400">
              {h.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
