import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { spawnEnv } from "./spawnEnv";

/** What a process launched from Finder or launchd actually inherits. */
const GUI_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";
const guiEnv = () => ({ ...process.env, PATH: GUI_PATH });

describe("spawnEnv", () => {
  // The actual failure this exists for: launched outside a login shell, none of
  // the tools Agent OS spawns are reachable.
  it("adds the install directories a GUI-launched process is missing", () => {
    const path = spawnEnv(guiEnv()).PATH!;
    expect(path).toContain("/opt/homebrew/bin");
    expect(path).toContain("/usr/local/bin");
    expect(path).toContain(`${homedir()}/.local/bin`);
  });

  // Order matters: an operator who put a specific toolchain first must keep it.
  it("appends rather than prepends, so the inherited PATH still wins", () => {
    const path = spawnEnv(guiEnv()).PATH!.split(":");
    expect(path.slice(0, 4)).toEqual(["/usr/bin", "/bin", "/usr/sbin", "/sbin"]);
  });

  it("does not duplicate a directory the parent already has", () => {
    const path = spawnEnv({ ...process.env, PATH: "/usr/bin:/opt/homebrew/bin" }).PATH!.split(":");
    expect(path.filter((d) => d === "/opt/homebrew/bin")).toHaveLength(1);
  });

  it("returns the environment untouched when nothing is missing", () => {
    const full = {
      ...process.env,
      PATH: ["/usr/bin", "/opt/homebrew/bin", "/usr/local/bin", `${homedir()}/.local/bin`, `${homedir()}/.bun/bin`].join(":"),
    };
    expect(spawnEnv(full)).toBe(full);
  });

  it("copes with no PATH at all", () => {
    expect(spawnEnv({ ...process.env, PATH: undefined }).PATH).toContain("/opt/homebrew/bin");
  });

  it("carries the rest of the environment through", () => {
    expect(spawnEnv({ ...guiEnv(), HOME: "/Users/x" }).HOME).toBe("/Users/x");
  });
});
