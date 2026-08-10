import { runCliAgent } from "@/lib/cliAgent";
import { timedRun } from "@/lib/runs";
import { buildTurnPrompt } from "./threadPrompt";
import type { EngineDeps } from "./threadEngine";

/**
 * Build the engine's `runTurn` from the real agent CLIs.
 *
 * Every turn goes through `timedRun`, so Observability picks threads up with no
 * extra work — success rate, latency and timeouts per agent, alongside council
 * and delegate. `batchId` groups the turns of one thread run, matching how
 * council groups a fan-out.
 */
export function makeTurnRunner(ctx: { repoPath: string; batchId: string }): EngineDeps["runTurn"] {
  return async (agent, transcript, mode) => {
    const prompt = buildTurnPrompt(transcript, agent.id);
    return timedRun(
      {
        feature: "threads",
        agent: agent.name,
        backend: agent.backend,
        task: prompt.slice(0, 140),
        repo: ctx.repoPath,
        batchId: ctx.batchId,
      },
      () =>
        runCliAgent(agent.backend, [{ role: "user", content: prompt }], undefined, {
          cwd: ctx.repoPath,
          // `mode` has one value in this block; a later block branches here.
          readOnly: mode === "discuss",
          timeoutMs: 300_000,
        }),
    );
  };
}
