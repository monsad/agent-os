import { describe, it, expect } from "vitest";
import { parseMentions, resolveMentions } from "./mentions";

describe("parseMentions", () => {
  it("pulls names out of a reply", () => {
    expect(parseMentions("I think @codex should check the index")).toEqual(["codex"]);
  });

  it("lowercases so @Codex and @codex are the same agent", () => {
    expect(parseMentions("@Codex and @OPENCLAW")).toEqual(["codex", "openclaw"]);
  });

  it("returns each name once even if mentioned repeatedly", () => {
    expect(parseMentions("@codex ... and again @codex")).toEqual(["codex"]);
  });

  it("ignores an email address, which is not a mention", () => {
    expect(parseMentions("mail me at someone@example.com")).toEqual([]);
  });

  it("returns nothing for text with no mentions", () => {
    expect(parseMentions("no one in particular")).toEqual([]);
  });
});

describe("resolveMentions", () => {
  it("resolves known names to roster agents", () => {
    expect(resolveMentions("ask @codex").map((a) => a.id)).toEqual(["codex"]);
  });

  // The safety rule: agents read the attached repo, so text in a source file
  // must never be able to name a process to launch.
  it("drops names that are not on the roster", () => {
    expect(resolveMentions("@rm-rf and @definitely-not-an-agent")).toEqual([]);
  });

  it("drops the speaker's own name so an agent cannot call itself", () => {
    expect(resolveMentions("@claude @codex", "claude").map((a) => a.id)).toEqual(["codex"]);
  });
});
