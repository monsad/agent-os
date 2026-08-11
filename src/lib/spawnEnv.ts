import { homedir } from "node:os";

/**
 * Where the tools Agent OS shells out to actually install.
 *
 * A process launched outside a login shell — from Finder, launchd, or a desktop
 * launcher — gets only `/usr/bin:/bin:/usr/sbin:/sbin`. On a normal developer
 * machine every tool this app spawns lives somewhere else: the agent CLIs, git,
 * ollama, graphify, hermes. So `spawn` fails with ENOENT before the tool ever
 * runs, and the failure is silent and instant — it looks like the tool refused,
 * not like it was never found.
 *
 * Observed on the machine this was written on: 65 chat runs failed this way
 * over seven weeks, each recorded as a 0ms agent failure while the CLI itself
 * worked fine from a terminal.
 */
const EXTRA_PATH_DIRS = [
  "/opt/homebrew/bin", // Homebrew on Apple Silicon
  "/usr/local/bin", // Homebrew on Intel, npm -g, most installer scripts
  `${homedir()}/.local/bin`,
  `${homedir()}/.bun/bin`,
];

/**
 * The parent environment, with any missing install directory appended to PATH.
 *
 * Appended rather than prepended so a deliberately ordered PATH still wins:
 * this adds fallbacks, it never shadows a tool the operator chose.
 */
export function spawnEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const dirs = (env.PATH ?? "").split(":").filter(Boolean);
  const missing = EXTRA_PATH_DIRS.filter((d) => !dirs.includes(d));
  if (missing.length === 0) return env;
  return { ...env, PATH: [...dirs, ...missing].join(":") };
}
