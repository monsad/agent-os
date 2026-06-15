import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appendTurn } from "./notes";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dir: string;
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), "notes-")); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe("appendTurn", () => {
  it("creates the file and writes both roles", async () => {
    await appendTurn(dir, "conv1", "user", "hi there");
    await appendTurn(dir, "conv1", "assistant", "hello back");
    const text = await readFile(path.join(dir, "conv1.md"), "utf-8");
    expect(text).toContain("**user:** hi there");
    expect(text).toContain("**assistant:** hello back");
  });

  it("sanitizes the conversation id into a safe filename", async () => {
    await appendTurn(dir, "../evil/id", "user", "x");
    const text = await readFile(path.join(dir, "evil-id.md"), "utf-8");
    expect(text).toContain("**user:** x");
  });

  it("throws when the conversation id reduces to an empty safe name", async () => {
    await expect(appendTurn(dir, "../", "user", "x")).rejects.toThrow(/empty safe name/);
  });
});
