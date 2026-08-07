"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { StatusStrip } from "./StatusStrip";
import { AgentCard } from "./AgentCard";
import { AgentControlRoom } from "./AgentControlRoom";
import { ContextRail } from "./ContextRail/ContextRail";
import { CouncilView } from "./CouncilView";
import { ReviewView } from "./ReviewView";
import { DelegateView } from "./DelegateView";
import { VariantsView } from "./VariantsView";
import { BrainView } from "./BrainView";
import { ObservabilityView } from "./ObservabilityView";
import { AGENTS, type Agent } from "./agents";

export function MissionControlLayout() {
  const [selected, setSelected] = useState<Agent | null>(null);
  const [view, setView] = useState("mission-control");

  return (
    <div className="flex h-screen">
      <Sidebar active={view} onWorkspace={setView} onSelectAgent={setSelected} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-8 py-8">
          <header className="mb-8 flex items-start justify-between">
            <div>
              <p className="eyebrow mb-3 flex items-center gap-2">
                <span className="text-neutral-600">I</span> — Mission Control
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-neutral-50">Mission Control</h1>
              <p className="mt-2 text-sm text-neutral-400">Status of every agent, every memory, every signal.</p>
              <p className="mono mt-2 text-[11px] text-neutral-600">local · studio</p>
            </div>
            <div className="flex gap-2">
              <button className="panel panel-hover rounded-lg px-3 py-1.5 text-[12px] text-neutral-300">⌘K Command palette</button>
              <button className="panel panel-hover rounded-lg px-3 py-1.5 text-[12px] text-neutral-300">▥ All systems</button>
            </div>
          </header>

          {view === "mission-control" && (
            <>
              <StatusStrip />

              <div className="my-9 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-neutral-600">✦</span>
                <span className="h-px flex-1 bg-white/[0.06]" />
              </div>

              <p className="eyebrow mb-4 flex items-center gap-2">
                <span className="text-neutral-600">II</span> — Agents · click to open control room
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {AGENTS.map((a) => (
                  <AgentCard key={a.id} agent={a} onOpen={setSelected} />
                ))}
              </div>
            </>
          )}

          {view === "council" && <CouncilView />}

          {view === "delegate" && <DelegateView />}

          {view === "variants" && <VariantsView />}

          {view === "review" && <ReviewView />}

          {view === "observability" && <ObservabilityView />}

          {view === "brain" && <BrainView />}

          {(view === "memory" || view === "graph") && (
            <div className="panel rounded-2xl p-5">
              <ContextRail />
            </div>
          )}
        </div>
      </main>

      {selected && <AgentControlRoom agent={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
