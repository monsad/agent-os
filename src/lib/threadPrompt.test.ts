import { describe, it, expect } from "vitest";
import { renderTranscript, buildTurnPrompt } from "./threadPrompt";
import type { ThreadMessage } from "./ghost";

function msg(author: string, body: string): ThreadMessage {
  return { id: 1, thread_id: 1, author, body, mentions: [], hop: 0, created_at: "" };
}

describe("renderTranscript", () => {
  it("labels each line with the speaker's display name", () => {
    const out = renderTranscript([msg("human", "should we cache this?"), msg("claude", "probably not")]);
    expect(out).toContain("Human: should we cache this?");
    expect(out).toContain("Claude: probably not");
  });

  it("falls back to the raw id for an author no longer on the roster", () => {
    expect(renderTranscript([msg("gemini", "hi")])).toContain("gemini: hi");
  });
});

describe("buildTurnPrompt", () => {
  it("carries the transcript into the prompt", () => {
    const p = buildTurnPrompt([msg("human", "is the index worth it?")], "codex");
    expect(p).toContain("is the index worth it?");
  });

  it("names the other participants the agent may hand off to, but not itself", () => {
    const p = buildTurnPrompt([msg("human", "hi")], "codex");
    expect(p).toContain("@claude");
    expect(p).toContain("@openclaw");
    expect(p).not.toContain("@codex");
  });

  it("tells the agent who it is", () => {
    expect(buildTurnPrompt([msg("human", "hi")], "codex")).toContain("You are Codex");
  });
});
