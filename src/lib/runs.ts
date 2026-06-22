import { appendFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "runs.jsonl");

export type RunStatus = "ok" | "fail" | "timeout";

export type RunRecord = {
  ts: number;
  feature: string; // chat | council | delegate | review | nightshift
  agent: string;
  backend?: string;
  task: string; // short preview
  durationMs: number;
  status: RunStatus;
  outputChars: number;
  repo?: string | null;
  batchId?: string; // same task fanned across agents (head-to-head)
};

export function newBatchId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function recordRun(r: Omit<RunRecord, "ts">): Promise<void> {
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await appendFile(FILE, JSON.stringify({ ts: Date.now(), ...r }) + "\n", "utf-8");
  } catch {
    // observability must never break a real run
  }
}

// Time a single agent call and record it. Re-throws so callers keep their flow.
export async function timedRun<T>(
  meta: { feature: string; agent: string; backend?: string; task: string; repo?: string | null; batchId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await recordRun({
      ...meta,
      durationMs: Date.now() - start,
      status: "ok",
      outputChars: typeof result === "string" ? result.length : 0,
    });
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    await recordRun({
      ...meta,
      durationMs: Date.now() - start,
      status: /timed out/i.test(msg) ? "timeout" : "fail",
      outputChars: 0,
    });
    throw e;
  }
}

export async function readRuns(limit = 2000): Promise<RunRecord[]> {
  try {
    const text = await readFile(FILE, "utf-8");
    const lines = text.trim().split("\n").filter(Boolean);
    const recs = lines.slice(-limit).map((l) => JSON.parse(l) as RunRecord);
    return recs;
  } catch {
    return [];
  }
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

export type AgentStat = {
  agent: string;
  runs: number;
  okRate: number;
  timeouts: number;
  avgMs: number;
  p95Ms: number;
};

export function agentStats(runs: RunRecord[]): AgentStat[] {
  const byAgent = new Map<string, RunRecord[]>();
  for (const r of runs) {
    if (!byAgent.has(r.agent)) byAgent.set(r.agent, []);
    byAgent.get(r.agent)!.push(r);
  }
  const stats: AgentStat[] = [];
  for (const [agent, rs] of byAgent) {
    const durs = rs.map((r) => r.durationMs).sort((a, b) => a - b);
    const oks = rs.filter((r) => r.status === "ok").length;
    stats.push({
      agent,
      runs: rs.length,
      okRate: Math.round((oks / rs.length) * 100),
      timeouts: rs.filter((r) => r.status === "timeout").length,
      avgMs: Math.round(durs.reduce((a, b) => a + b, 0) / durs.length),
      p95Ms: pct(durs, 95),
    });
  }
  return stats.sort((a, b) => b.runs - a.runs);
}
