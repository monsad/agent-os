import { readRuns, agentStats, type RunRecord } from "@/lib/runs";

type BatchRow = { agent: string; durationMs: number; status: string };
type Batch = { batchId: string; feature: string; task: string; ts: number; rows: BatchRow[] };

function headToHead(runs: RunRecord[], limit = 8): Batch[] {
  const byBatch = new Map<string, RunRecord[]>();
  for (const r of runs) {
    if (!r.batchId) continue;
    if (!byBatch.has(r.batchId)) byBatch.set(r.batchId, []);
    byBatch.get(r.batchId)!.push(r);
  }
  const batches: Batch[] = [];
  for (const [batchId, rs] of byBatch) {
    if (rs.length < 2) continue; // head-to-head needs ≥2 agents on the same task
    batches.push({
      batchId,
      feature: rs[0].feature,
      task: rs[0].task,
      ts: Math.max(...rs.map((r) => r.ts)),
      rows: rs
        .map((r) => ({ agent: r.agent, durationMs: r.durationMs, status: r.status }))
        .sort((a, b) => a.durationMs - b.durationMs),
    });
  }
  return batches.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export async function GET(): Promise<Response> {
  const runs = await readRuns();
  return Response.json({
    total: runs.length,
    agents: agentStats(runs),
    recent: runs.slice(-30).reverse(),
    batches: headToHead(runs),
  });
}
