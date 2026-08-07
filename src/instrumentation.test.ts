import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./instrumentation-node", () => ({ sweepStaleWorktrees: vi.fn() }));

import { sweepStaleWorktrees } from "./instrumentation-node";
import { register } from "./instrumentation";

afterEach(() => vi.restoreAllMocks());

describe("register", () => {
  it("runs the sweep on the nodejs runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    (sweepStaleWorktrees as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await register();
    expect(sweepStaleWorktrees).toHaveBeenCalled();
  });

  it("skips the sweep on the edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    expect(sweepStaleWorktrees).not.toHaveBeenCalled();
  });
});
