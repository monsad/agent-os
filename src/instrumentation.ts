// Next.js instrumentation hook — runs once when the server process starts.
// Must stay edge-safe itself: the actual (node:fs/node:child_process-using)
// sweep logic lives in ./instrumentation-node, imported only behind this
// exact `NEXT_RUNTIME === "nodejs"` + string-literal-import shape, which is
// what lets webpack tree-shake it out of the edge runtime bundle.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { sweepStaleWorktrees } = await import("./instrumentation-node");
    await sweepStaleWorktrees();
  }
}
