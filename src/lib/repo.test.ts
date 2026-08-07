// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isAllowedRepoPath, setRepoPath } from "./repo";

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

// Attaching a directory points file-reading agents at it, so the guard here is
// what stops "attach ~/.ssh" from turning into an exfiltration primitive.
describe("isAllowedRepoPath", () => {
  it("allows a git repository", () => {
    dir = mkdtempSync(path.join(tmpdir(), "agentos-repo-"));
    mkdirSync(path.join(dir, ".git"));
    expect(isAllowedRepoPath(dir)).toBe(true);
  });

  it("rejects a plain directory that is not a git repo", () => {
    dir = mkdtempSync(path.join(tmpdir(), "agentos-plain-"));
    expect(isAllowedRepoPath(dir)).toBe(false);
  });

  it("rejects sensitive home directories", () => {
    expect(isAllowedRepoPath(path.join(process.env.HOME ?? "/home/x", ".ssh"))).toBe(false);
    expect(isAllowedRepoPath("/etc")).toBe(false);
  });

  it("allows the app's own data dir, which holds uploads and clones", () => {
    expect(isAllowedRepoPath(path.join(process.cwd(), "data", "context"))).toBe(true);
    expect(isAllowedRepoPath(path.join(process.cwd(), "data", "repos", "some-repo"))).toBe(true);
  });

  it("does not let a data-dir prefix be escaped with ..", () => {
    expect(isAllowedRepoPath(path.resolve(process.cwd(), "data", "..", "..", "elsewhere"))).toBe(false);
  });
});

describe("setRepoPath", () => {
  it("refuses a non-git directory with an explanatory error", () => {
    dir = mkdtempSync(path.join(tmpdir(), "agentos-plain-"));
    expect(() => setRepoPath(dir!)).toThrow(/not a git repository/);
  });

  it("refuses a path that does not exist", () => {
    expect(() => setRepoPath("/definitely/not/here")).toThrow(/not a directory/);
  });
});
