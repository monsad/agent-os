import { describe, it, expect } from "vitest";
import { CLI_ROSTER, selectAgents } from "./roster";

describe("CLI_ROSTER", () => {
  it("lists the file-capable CLI agents with unique ids", () => {
    const ids = CLI_ROSTER.map((a) => a.id);
    expect(ids).toEqual(["claude", "codex", "openclaw"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Gemini's free CLI tier was retired; a stray entry would make every fan-out
  // feature spend a run on an agent that always fails.
  it("does not include gemini", () => {
    expect(CLI_ROSTER.some((a) => a.backend === "gemini")).toBe(false);
  });
});

describe("selectAgents", () => {
  it("returns the whole roster when nothing is selected", () => {
    expect(selectAgents()).toHaveLength(CLI_ROSTER.length);
    expect(selectAgents([])).toHaveLength(CLI_ROSTER.length);
  });

  it("filters to the requested ids, preserving roster order", () => {
    expect(selectAgents(["openclaw", "claude"]).map((a) => a.id)).toEqual(["claude", "openclaw"]);
  });

  it("ignores unknown ids rather than failing the run", () => {
    expect(selectAgents(["claude", "nope"]).map((a) => a.id)).toEqual(["claude"]);
    expect(selectAgents(["nope"])).toEqual([]);
  });

  it("hands back a copy, so a caller cannot mutate the roster", () => {
    const picked = selectAgents();
    picked.pop();
    expect(CLI_ROSTER).toHaveLength(3);
  });
});
