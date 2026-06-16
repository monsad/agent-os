export type AgentStatus = "online" | "offline" | "data";

export type Backend = "ollama" | "claude" | "codex";

export type Agent = {
  id: string;
  name: string;
  status: AgentStatus;
  tagline: string;
  meta: { label: string; value: string }[];
  accent: string; // tailwind gradient stops, e.g. "from-emerald-400 to-teal-500"
  live?: boolean; // backed by a real backend
  backend?: Backend; // which backend powers chat
};

export const AGENTS: Agent[] = [
  {
    id: "local-llm",
    name: "Local LLM",
    status: "online",
    tagline: "Direct streaming line to your local model. Full chat, memory, notes.",
    meta: [
      { label: "Model", value: "qwen2.5:14b" },
      { label: "Provider", value: "Ollama" },
    ],
    accent: "from-emerald-400 to-teal-500",
    live: true,
    backend: "ollama",
  },
  {
    id: "claude",
    name: "Claude",
    status: "online",
    tagline: "Claude Code on your subscription — no API key. Full reasoning + tools.",
    meta: [
      { label: "Auth", value: "subscription" },
      { label: "CLI", value: "claude -p" },
    ],
    accent: "from-orange-400 to-amber-500",
    live: true,
    backend: "claude",
  },
  {
    id: "codex",
    name: "Codex",
    status: "online",
    tagline: "OpenAI Codex on your ChatGPT subscription — no API key.",
    meta: [
      { label: "Auth", value: "subscription" },
      { label: "CLI", value: "codex exec" },
    ],
    accent: "from-violet-400 to-indigo-500",
    live: true,
    backend: "codex",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    status: "offline",
    tagline: "Local agent gateway. Routes tasks between agents.",
    meta: [
      { label: "Agents", value: "0" },
      { label: "Sessions", value: "0" },
    ],
    accent: "from-pink-400 to-rose-500",
  },
  {
    id: "hermes",
    name: "Hermes",
    status: "offline",
    tagline: "Research agent. Tool calls, kanban, skills, plugins.",
    meta: [
      { label: "Model", value: "stub" },
      { label: "Provider", value: "—" },
    ],
    accent: "from-sky-400 to-blue-500",
  },
  {
    id: "gemini",
    name: "Gemini",
    status: "offline",
    tagline: "Google multimodal agent. Vision + long context.",
    meta: [
      { label: "Model", value: "stub" },
      { label: "Provider", value: "—" },
    ],
    accent: "from-fuchsia-400 to-pink-500",
  },
];

export const STATUS_DOT: Record<AgentStatus, string> = {
  online: "bg-emerald-400",
  data: "bg-sky-400",
  offline: "bg-neutral-600",
};

export const STATUS_LABEL: Record<AgentStatus, string> = {
  online: "online",
  data: "data",
  offline: "offline",
};
