import { describe, it, expect } from "vitest";
import { WORKSPACES, workspaceFor } from "./workspaces";

describe("workspaces", () => {
  it("resolves a known view", () => {
    expect(workspaceFor("threads").label).toBe("Threads");
  });

  // The header reads from this; an unknown id must not blank it out.
  it("falls back to the first workspace for an unknown id", () => {
    expect(workspaceFor("nope")).toBe(WORKSPACES[0]);
  });

  it("gives every workspace a blurb, since the header always renders one", () => {
    for (const w of WORKSPACES) {
      expect(w.blurb.length, `${w.id} has no blurb`).toBeGreaterThan(0);
    }
  });

  it("keeps ids unique, or the sidebar would highlight two entries at once", () => {
    const ids = WORKSPACES.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
