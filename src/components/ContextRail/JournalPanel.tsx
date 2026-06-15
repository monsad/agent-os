"use client";
import { useEffect, useState } from "react";

type Entry = { id: number; summary: string; created_at: string };

export function JournalPanel() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  useEffect(() => {
    fetch("/api/journal").then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setEntries(d.entries ?? []))
      .catch(() => setEntries([]));
  }, []);
  return (
    <div className="space-y-1">
      <h3 className="text-xs uppercase tracking-wide text-neutral-500">Journal</h3>
      {entries === null && <p className="text-xs text-neutral-600">loading…</p>}
      {entries?.length === 0 && <p className="text-xs text-neutral-600">No entries yet.</p>}
      {entries?.map((e) => (
        <div key={e.id} className="text-xs text-neutral-400">{e.summary}</div>
      ))}
    </div>
  );
}
