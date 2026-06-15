"use client";
import { useEffect, useState } from "react";

type Goal = { id: number; title: string; status: string };

export function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  useEffect(() => {
    fetch("/api/goals").then((r) => (r.ok ? r.json() : { goals: [] }))
      .then((d) => setGoals(d.goals ?? []))
      .catch(() => setGoals([]));
  }, []);
  return (
    <div className="space-y-1">
      <h3 className="text-xs uppercase tracking-wide text-neutral-500">Goals</h3>
      {goals === null && <p className="text-xs text-neutral-600">loading…</p>}
      {goals?.length === 0 && <p className="text-xs text-neutral-600">No goals yet.</p>}
      {goals?.map((g) => (
        <div key={g.id} className="text-sm">• {g.title} <span className="text-neutral-500">({g.status})</span></div>
      ))}
    </div>
  );
}
