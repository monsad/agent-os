"use client";
import { AGENTS, STATUS_DOT, type Agent } from "./agents";

const WORKSPACE = [
  { id: "mission-control", label: "Mission Control", icon: "▦" },
  { id: "council", label: "Broad Opinion", icon: "⚖" },
  { id: "delegate", label: "Delegate Task", icon: "⇶" },
  { id: "review", label: "Code Review", icon: "✓" },
  { id: "brain", label: "Night Shift", icon: "☾" },
  { id: "memory", label: "Memory", icon: "◍" },
  { id: "graph", label: "Knowledge Graph", icon: "✸" },
];

export function Sidebar({
  active,
  onWorkspace,
  onSelectAgent,
}: {
  active: string;
  onWorkspace: (id: string) => void;
  onSelectAgent: (a: Agent) => void;
}) {
  return (
    <nav className="flex h-screen w-[230px] flex-col gap-6 overflow-y-auto border-r border-white/[0.08] bg-white/[0.03] px-3 py-5 backdrop-blur-2xl">
      <div className="flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-xs font-bold text-black">
          A
        </span>
        <span className="text-sm">
          Agentic <span className="italic text-neutral-400">OS</span>
        </span>
      </div>

      <div>
        <p className="eyebrow mb-2 px-2">Workspace</p>
        <div className="flex flex-col gap-0.5">
          {WORKSPACE.map((w) => (
            <button
              key={w.id}
              onClick={() => onWorkspace(w.id)}
              className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] transition ${
                active === w.id ? "bg-white/[0.06] text-neutral-100" : "text-neutral-400 hover:bg-white/[0.03]"
              }`}
            >
              <span className="text-neutral-500">{w.icon}</span>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-2 px-2">Agents</p>
        <div className="flex flex-col gap-0.5">
          {AGENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelectAgent(a)}
              className="group flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] text-neutral-300 transition hover:bg-white/[0.03]"
            >
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[a.status]}`} />
              <span className="flex-1 group-hover:text-neutral-100">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
