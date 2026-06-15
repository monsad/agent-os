"use client";

export type AgentStatus = "online" | "offline" | "data";
export type Agent = { id: string; name: string; status: AgentStatus; role: string };

export const AGENTS: Agent[] = [
  { id: "local-llm", name: "Local LLM", status: "online", role: "Intelligence" },
  { id: "ghost", name: "Ghost", status: "data", role: "Data store" },
  { id: "execution", name: "Execution", status: "offline", role: "OpenClaw (stub)" },
  { id: "research", name: "Research", status: "offline", role: "Hermes (stub)" },
];

const DOT: Record<AgentStatus, string> = {
  online: "bg-emerald-500",
  data: "bg-sky-500",
  offline: "bg-neutral-600",
};

export function AgentRail({ onSelect }: { onSelect: (a: Agent) => void }) {
  return (
    <nav className="flex h-full flex-col gap-1 border-r border-neutral-800 p-3">
      <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Agents</h2>
      {AGENTS.map((a) => (
        <button
          key={a.id}
          onClick={() => onSelect(a)}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-neutral-900"
        >
          <span className={`h-2 w-2 rounded-full ${DOT[a.status]}`} />
          <span className="flex-1">{a.name}</span>
          <span className="text-xs text-neutral-500">{a.status}</span>
        </button>
      ))}
    </nav>
  );
}
