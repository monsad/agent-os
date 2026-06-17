"use client";
import { useEffect, useState } from "react";

const TABS = [
  { id: "status", label: "Status", cmd: "status" },
  { id: "skills", label: "Skills", cmd: null },
  { id: "kanban", label: "Kanban", cmd: null },
  { id: "plugins", label: "Plugins", cmd: "plugins" },
] as const;

type Task = { id: string; title: string; status: string; assignee: string | null };

const STATUS_COLOR: Record<string, string> = {
  ready: "text-emerald-300", running: "text-cyan-300", blocked: "text-amber-300",
  done: "text-neutral-500", todo: "text-neutral-300", triage: "text-neutral-400",
};

function KanbanPanel() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function load() {
    fetch("/api/hermes/kanban").then((r) => r.json()).then((d) => setTasks(d.tasks ?? [])).catch(() => setErr("kanban unreachable"));
  }
  useEffect(load, []);

  async function act(body: object) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/hermes/kanban", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (res.ok) setTasks(d.tasks ?? []);
      else setErr(d.error ?? "failed");
    } finally {
      setBusy(false);
    }
  }

  const open = (tasks ?? []).filter((t) => t.status !== "done");
  const done = (tasks ?? []).filter((t) => t.status === "done");

  return (
    <div className="space-y-3 p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (title.trim()) { act({ action: "create", title }); setTitle(""); } }}
        className="flex gap-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task…"
          disabled={busy}
          className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none focus:border-cyan-400/70"
        />
        <button type="submit" disabled={busy || !title.trim()} className="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-4 py-2 text-sm font-medium text-cyan-100 disabled:opacity-40">
          Add
        </button>
      </form>
      {err && <p className="text-sm text-amber-300">{err}</p>}
      {tasks === null && <p className="mono text-xs text-neutral-500">loading…</p>}
      {tasks && open.length === 0 && done.length === 0 && <p className="text-sm text-neutral-500">No tasks yet. Add one above.</p>}

      {open.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <span className={`mono text-[11px] ${STATUS_COLOR[t.status] ?? "text-neutral-400"}`}>{t.status}</span>
          <span className="flex-1 text-sm text-neutral-100">{t.title}</span>
          <button onClick={() => act({ action: "complete", id: t.id })} disabled={busy} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-neutral-300 hover:bg-white/5 disabled:opacity-40">
            Done
          </button>
        </div>
      ))}
      {done.length > 0 && (
        <details className="pt-1">
          <summary className="cursor-pointer text-xs text-neutral-500">Done ({done.length})</summary>
          {done.map((t) => (
            <p key={t.id} className="px-3 py-1 text-sm text-neutral-500 line-through">{t.title}</p>
          ))}
        </details>
      )}
    </div>
  );
}

function parseSkillNames(table: string): string[] {
  return table
    .split("\n")
    .map((l) => l.split("│"))
    .filter((cells) => cells.length > 2)
    .map((cells) => cells[1]?.trim())
    .filter((n): n is string => Boolean(n) && n !== "Name" && !/^[━─]+$/.test(n));
}

function SkillsPanel() {
  const [names, setNames] = useState<string[]>([]);
  const [raw, setRaw] = useState("");
  const [skill, setSkill] = useState("");
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hermes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd: "skills" }) })
      .then((r) => r.json())
      .then((d) => {
        const list = parseSkillNames(d.output ?? "");
        setNames(list);
        setRaw(d.output ?? "");
        if (list[0]) setSkill(list[0]);
      })
      .catch(() => setErr("could not list skills"));
  }, []);

  async function runSkill() {
    if (!skill || !prompt.trim()) return;
    setRunning(true);
    setErr(null);
    setOutput(null);
    try {
      const res = await fetch("/api/hermes/skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, prompt }),
      });
      const d = await res.json();
      setOutput(d.output ?? d.error ?? "no output");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3 p-4">
      <p className="eyebrow">Run a skill</p>
      <div className="flex gap-2">
        <select
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-neutral-200 outline-none focus:border-cyan-400/60"
        >
          {names.map((n) => (
            <option key={n} value={n} className="bg-neutral-900">{n}</option>
          ))}
        </select>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What should this skill do?"
          className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-400 outline-none focus:border-cyan-400/70"
        />
        <button onClick={runSkill} disabled={running || !skill || !prompt.trim()} className="rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 px-4 py-2 text-sm font-medium text-black/80 disabled:opacity-40">
          {running ? "Running…" : "Run"}
        </button>
      </div>
      {running && <p className="mono text-xs text-neutral-500">hermes is running the skill — needs a working model (hermes model → Codex).</p>}
      {err && <p className="text-sm text-amber-300">{err}</p>}
      {output && <pre className="mono whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-[12px] text-neutral-300">{output.trim()}</pre>}
      <details className="pt-1">
        <summary className="cursor-pointer text-xs text-neutral-500">Installed skills ({names.length})</summary>
        <pre className="mono mt-2 whitespace-pre overflow-x-auto text-[11px] text-neutral-400">{raw.trim()}</pre>
      </details>
    </div>
  );
}

export function HermesControlRoom() {
  const [tab, setTab] = useState<string>("status");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cmd = TABS.find((t) => t.id === tab)?.cmd;

  useEffect(() => {
    if (!cmd) return;
    setLoading(true);
    setErr(null);
    fetch("/api/hermes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cmd }) })
      .then((r) => r.json())
      .then((d) => (d.output != null ? setOutput(d.output) : setErr(d.error ?? "failed")))
      .catch(() => setErr("hermes unreachable"))
      .finally(() => setLoading(false));
  }, [cmd]);

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
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "kanban" ? (
          <KanbanPanel />
        ) : tab === "skills" ? (
          <SkillsPanel />
        ) : (
          <div className="p-4">
            {loading && <p className="mono text-xs text-neutral-500">running hermes {tab}…</p>}
            {err && <p className="text-sm text-amber-300">{err.includes("not found") ? "Hermes CLI not found on PATH." : err}</p>}
            {!loading && !err && output && (
              <pre className="mono whitespace-pre overflow-x-auto text-[12px] leading-relaxed text-neutral-300">{output.trim()}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
