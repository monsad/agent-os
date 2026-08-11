// Single source of truth for the workspace views: the sidebar renders this list,
// and the page header reads its title and blurb from the same entry.
//
// They used to be separate — the sidebar had the labels and the header hard-coded
// "Mission Control" — so switching view left the heading claiming the wrong page.
// Anything added here appears in both places at once.
export type Workspace = { id: string; label: string; icon: string; blurb: string };

export const WORKSPACES: readonly Workspace[] = [
  { id: "mission-control", label: "Mission Control", icon: "▦", blurb: "Status of every agent, every memory, every signal." },
  { id: "council", label: "Broad Opinion", icon: "⚖", blurb: "One question, every agent, answered independently." },
  { id: "threads", label: "Threads", icon: "☰", blurb: "One conversation. Agents read it all and hand the floor to each other." },
  { id: "delegate", label: "Delegate Task", icon: "⇶", blurb: "Log a task and collect a proposal from every agent." },
  { id: "variants", label: "Run Variants", icon: "⎇", blurb: "The same task in isolated worktrees. You pick the winner." },
  { id: "review", label: "Code Review", icon: "✓", blurb: "The working diff, read through several lenses." },
  { id: "observability", label: "Observability", icon: "▤", blurb: "Which agent is fast, which one fails, on your real tasks." },
  { id: "brain", label: "Night Shift", icon: "☾", blurb: "Captures refined into atoms, threads and briefings." },
  { id: "memory", label: "Memory", icon: "◍", blurb: "Everything the workspace remembers." },
  { id: "graph", label: "Knowledge Graph", icon: "✸", blurb: "Your notes as a graph you can question." },
];

/** The active workspace, falling back to the first so the header is never blank. */
export function workspaceFor(id: string): Workspace {
  return WORKSPACES.find((w) => w.id === id) ?? WORKSPACES[0];
}
