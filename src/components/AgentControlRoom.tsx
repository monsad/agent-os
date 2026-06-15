"use client";
import { useState } from "react";
import type { Agent } from "./AgentRail";

const TABS = ["Config", "History", "Skills", "Plugins", "Tasks", "Usage"] as const;
type Tab = (typeof TABS)[number];

export function AgentControlRoom({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("Config");
  const live = agent.id === "local-llm";

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-[640px] max-w-[90vw] rounded-lg border border-neutral-800 bg-neutral-950 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{agent.name} — Control Room</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">✕</button>
        </div>
        <div className="mb-3 flex gap-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-1 ${tab === t ? "bg-neutral-800" : "text-neutral-500"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="min-h-[140px] text-sm text-neutral-300">
          {tab === "Config" && (
            <p>Role: {agent.role}. {live ? "Backed by Ollama gpt-oss:20b." : "Stub — wired in a later etap."}</p>
          )}
          {tab === "History" && <p>{live ? "Conversation history is stored in Ghost." : "No history (stub)."}</p>}
          {tab !== "Config" && tab !== "History" && (
            <p className="text-neutral-500">{tab} — scaffolded for etap 2.</p>
          )}
        </div>
      </div>
    </div>
  );
}
