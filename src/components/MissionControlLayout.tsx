"use client";
import { useState } from "react";
import { AgentRail, type Agent } from "./AgentRail";
import { AgentControlRoom } from "./AgentControlRoom";
import { ChatWorkspace } from "./ChatWorkspace";
import { ContextRail } from "./ContextRail/ContextRail";

const CONVERSATION_ID = "default";

export function MissionControlLayout() {
  const [selected, setSelected] = useState<Agent | null>(null);
  return (
    <div className="grid h-screen grid-cols-[220px_1fr_320px]">
      <AgentRail onSelect={setSelected} />
      <ChatWorkspace conversationId={CONVERSATION_ID} />
      <ContextRail />
      {selected && <AgentControlRoom agent={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
