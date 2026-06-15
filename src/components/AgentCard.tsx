"use client";
import { STATUS_DOT, STATUS_LABEL, type Agent } from "./agents";

export function AgentCard({ agent, onOpen }: { agent: Agent; onOpen: (a: Agent) => void }) {
  const online = agent.status === "online";
  return (
    <button
      onClick={() => onOpen(agent)}
      className="panel panel-hover group flex flex-col rounded-2xl p-5 text-left"
    >
      <div className="mb-4 flex items-start justify-between">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${agent.accent} text-base font-semibold text-black/80`}
        >
          {agent.name[0]}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[agent.status]}`} />
          <span className="eyebrow">{STATUS_LABEL[agent.status]}</span>
        </span>
      </div>

      <div className="mb-1 flex items-center gap-1.5">
        <h3 className="text-[15px] text-neutral-100">{agent.name}</h3>
        <span className="text-neutral-600 opacity-0 transition group-hover:opacity-100">↗</span>
      </div>
      <p className="mb-5 text-[13px] leading-relaxed text-neutral-400">{agent.tagline}</p>

      <div className="mt-auto grid grid-cols-2 gap-2.5">
        {agent.meta.map((m) => (
          <div key={m.label} className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2">
            <p className="eyebrow mb-0.5">{m.label}</p>
            <p className="mono text-[12px] text-neutral-200">{m.value}</p>
          </div>
        ))}
      </div>

      <p className={`mt-4 text-[11px] font-medium uppercase tracking-wider ${online ? "text-emerald-400/80" : "text-neutral-500"}`}>
        Open control room →
      </p>
    </button>
  );
}
