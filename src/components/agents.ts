export type AgentStatus = "online" | "offline" | "data";

export type Backend = "ollama" | "claude" | "codex" | "opencode" | "gemini";

export type Agent = {
  id: string;
  name: string;
  status: AgentStatus;
  tagline: string;
  meta: { label: string; value: string }[];
  accent: string; // tailwind gradient stops, e.g. "from-emerald-400 to-teal-500"
  live?: boolean; // backed by a real backend
  backend?: Backend; // which backend powers chat
  model?: string; // ollama model override (when backend === "ollama")
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
    status: "online",
    tagline: "Local agent gateway via opencode — runs tasks through your local setup.",
    meta: [
      { label: "CLI", value: "opencode run" },
      { label: "Mode", value: "local" },
    ],
    accent: "from-pink-400 to-rose-500",
    live: true,
    backend: "opencode",
  },
  {
    id: "hermes",
    name: "Hermes",
    status: "online",
    tagline: "Full Hermes agent — skills, kanban, plugins. Control panel inside.",
    meta: [
      { label: "CLI", value: "hermes" },
      { label: "Panel", value: "skills · kanban" },
    ],
    accent: "from-sky-400 to-blue-500",
    live: true,
    backend: "ollama",
    model: "hermes3:8b",
  },
  {
    id: "gemini",
    name: "Gemini",
    status: "offline",
    tagline: "Free CLI tier retired by Google (migrate to Antigravity, or use a GEMINI_API_KEY).",
    meta: [
      { label: "Auth", value: "free tier ended" },
      { label: "CLI", value: "gemini -p" },
    ],
    accent: "from-fuchsia-400 to-pink-500",
    backend: "gemini",
  },
];

// Every model option the user has, usable from any chat.
export type BackendOption = { id: string; label: string; backend: Backend; model?: string };

export const BACKEND_OPTIONS: BackendOption[] = [
  { id: "claude", label: "Claude Opus · Max", backend: "claude" },
  { id: "codex", label: "GPT-5.5 · Plus", backend: "codex" },
  { id: "opencode", label: "OpenClaw · opencode", backend: "opencode" },
  { id: "ollama-qwen", label: "Local · qwen2.5:14b", backend: "ollama", model: "qwen2.5:14b" },
  { id: "ollama-hermes", label: "Local · hermes3:8b", backend: "ollama", model: "hermes3:8b" },
];

const DEFAULT_OPTION = "ollama-qwen";

export function optionFor(backend?: Backend, model?: string): BackendOption {
  return (
    BACKEND_OPTIONS.find((o) => o.backend === backend && (o.model ?? undefined) === (model ?? undefined)) ??
    BACKEND_OPTIONS.find((o) => o.backend === backend) ??
    BACKEND_OPTIONS.find((o) => o.id === DEFAULT_OPTION) ??
    BACKEND_OPTIONS[0]
  );
}

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
