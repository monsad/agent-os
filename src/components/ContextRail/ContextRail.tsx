import { GoalsPanel } from "./GoalsPanel";
import { JournalPanel } from "./JournalPanel";
import { GraphExplorer } from "./GraphExplorer";

export function ContextRail() {
  return (
    <aside className="flex h-full flex-col gap-5 overflow-y-auto border-l border-neutral-800 p-3">
      <GoalsPanel />
      <JournalPanel />
      <GraphExplorer />
    </aside>
  );
}
