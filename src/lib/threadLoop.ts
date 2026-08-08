import { getStore } from "./ghost";
import { runThread, type ThreadTurn } from "./threadEngine";
import { makeTurnRunner } from "./threadRunner";

/**
 * Start a thread run and return immediately; the UI polls for progress.
 *
 * Deliberately not awaited by the route. Agent OS runs as a long-lived Node
 * process (`next start` on the host), not on a serverless platform that would
 * freeze the container once the response is sent, so the loop survives past the
 * HTTP response.
 */
export function startLoop(
  threadId: number,
  seed: ThreadTurn[],
  repoPath: string,
  batchId: string,
): void {
  const store = getStore();
  void (async () => {
    await store.setThreadStatus(threadId, "running");
    try {
      await runThread(seed, {
        runTurn: makeTurnRunner({ repoPath, batchId }),
        appendMessage: (m) => store.addThreadMessage(threadId, m).then(() => undefined),
        loadTranscript: () => store.listThreadMessages(threadId),
        isStopped: async () => (await store.getThreadById(threadId))?.status === "stopped",
      });
    } finally {
      // A thread that ended on its own is waiting for the operator again, which
      // is what `idle` means. `stopped` is left alone so "I interrupted this"
      // stays distinguishable from "this finished".
      const t = await store.getThreadById(threadId);
      if (t?.status !== "stopped") await store.setThreadStatus(threadId, "idle");
    }
  })();
}
