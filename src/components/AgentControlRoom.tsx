"use client";
import { useState } from "react";
import { STATUS_DOT, STATUS_LABEL, type Agent } from "./agents";
import { ChatWorkspace } from "./ChatWorkspace";
import { GraphExplorer } from "./ContextRail/GraphExplorer";

const TABS = ["Chat", "Memory", "Config"] as const;
type Tab = (typeof TABS)[number];

export function AgentControlRoom({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(agent.live ? "Chat" : "Config");

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="flex h-[80vh] w-[760px] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0b0d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${agent.accent} text-sm font-semibold text-black/80`}>
              {agent.name[0]}
            </span>
            <div>
              <p className="text-sm text-neutral-100">{agent.name} — Control Room</p>
              <p className="mono mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[agent.status]}`} />
                {STATUS_LABEL[agent.status]} · {agent.meta.map((m) => m.value).join(" · ")}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-neutral-500 hover:text-neutral-200">✕</button>
        </div>

        <div className="flex gap-1 border-b border-white/[0.06] px-4 py-2 text-xs">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 transition ${tab === t ? "bg-white/[0.07] text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "Chat" &&
            (agent.live ? (
              <ChatWorkspace conversationId={`agent:${agent.id}`} backend={agent.backend} />
            ) : (
              <Placeholder text={`${agent.name} is a stub. Wire a backend to enable chat (etap 2).`} />
            ))}
          {tab === "Memory" &&
            (agent.live ? (
              <div className="p-4">
                <GraphExplorer />
              </div>
            ) : (
              <Placeholder text="No memory for stub agents yet." />
            ))}
          {tab === "Config" && (
            <div className="space-y-3 p-5 text-sm text-neutral-300">
              <p className="text-neutral-400">{agent.tagline}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {agent.meta.map((m) => (
                  <div key={m.label} className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2">
                    <p className="eyebrow mb-0.5">{m.label}</p>
                    <p className="mono text-[12px] text-neutral-200">{m.value}</p>
                  </div>
                ))}
              </div>
              <p className="mono text-[11px] text-neutral-600">
                {agent.live ? "Backed by Ollama. Chat + memory are live." : "Stub agent — scaffolded for etap 2."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-neutral-500">{text}</div>;
}
