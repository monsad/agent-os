"use client";
import { useEffect, useState } from "react";

type Goal = { id: number; title: string; status: string; priority?: string };

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-neutral-500",
};

export function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [draft, setDraft] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/goals");
      const d = r.ok ? await r.json() : { goals: [] };
      setGoals(d.goals ?? []);
    } catch {
      setGoals([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    await fetch("/api/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await load();
  }

  async function toggle(g: Goal) {
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: g.id, status: g.status === "done" ? "open" : "done" }),
    });
    await load();
  }

  async function remove(g: Goal) {
    await fetch("/api/goals", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: g.id }),
    });
    await load();
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs uppercase tracking-wide text-neutral-500">Goals</h3>
      <div className="flex gap-1">
        <input
          aria-label="New goal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a goal…"
          className="flex-1 rounded bg-neutral-900/50 px-2 py-1 text-sm outline-none"
        />
        <button onClick={add} className="rounded px-2 py-1 text-sm text-teal-400 hover:bg-neutral-800">
          +
        </button>
      </div>
      {goals === null && <p className="text-xs text-neutral-600">loading…</p>}
      {goals?.length === 0 && <p className="text-xs text-neutral-600">No goals yet.</p>}
      {goals?.map((g) => (
        <div key={g.id} className="group flex items-center gap-1 text-sm">
          <button
            onClick={() => toggle(g)}
            aria-label={g.status === "done" ? "Reopen goal" : "Complete goal"}
            className="text-neutral-500 hover:text-teal-400"
          >
            {g.status === "done" ? "☑" : "☐"}
          </button>
          <span className={g.status === "done" ? "flex-1 text-neutral-500 line-through" : "flex-1"}>
            {g.title}
          </span>
          {g.priority && (
            <span
              className={`text-[10px] uppercase ${PRIORITY_COLOR[g.priority] ?? "text-neutral-500"}`}
              title={`priority: ${g.priority}`}
            >
              {g.priority}
            </span>
          )}
          <button
            onClick={() => remove(g)}
            aria-label="Delete goal"
            className="text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
