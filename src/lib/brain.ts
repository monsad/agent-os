import { spawn } from "node:child_process";
import { spawnEnv } from "./spawnEnv";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const BRAIN_DIR = path.join(process.cwd(), "data", "brain");

const FOLDERS = ["0-raw", "1-desk", "2-atoms", "2-atoms/archive", "3-threads", "sources", "briefings"];

const HOUSE_RULES = `# House Rules — read this before any action

## The Pipeline
- 0-raw/    : Intake. READ ONLY. Never edit a raw capture.
- 1-desk/   : Scratch space. Clear it at end of shift.
- 2-atoms/  : Permanent atomic notes. One idea per file.
- 3-threads/: Synthesis docs. Update the relevant thread; don't duplicate.
- sources/  : Originals. READ ONLY.
- briefings/: Where you write back to the human.

## The Prime Directive
Every atomic note must trace to a real source in sources/ or 0-raw/.
No source, no note. You may not write a claim that is not in the material.
You do not fill gaps with plausible-sounding information. Ever.

## Working Rules
1. One idea per atom. If a source has eight ideas, make eight atoms.
2. Before creating an atom, search 2-atoms/ for an existing one to extend.
3. Every atom links to at least two related atoms when any exist.
4. When a new atom contradicts an existing one, add a [FRICTION] block to
   the new note pointing at the old. Never silently overwrite a belief.
5. Never delete. Mark superseded notes [RETIRED] and move to 2-atoms/archive/.
6. End every shift by updating the relevant thread and writing a briefing.

## Authority
- You may write only to 1-desk/, 2-atoms/, 3-threads/, and briefings/.
- Anything destructive or ambiguous: stop and flag it for the human. Do not guess.
`;

function git(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn("git", ["-C", BRAIN_DIR, ...args], { env: spawnEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", (d) => { out += d.toString(); });
    proc.on("error", () => resolve(""));
    proc.on("close", () => resolve(out));
  });
}

export async function initBrain(): Promise<void> {
  for (const f of FOLDERS) mkdirSync(path.join(BRAIN_DIR, f), { recursive: true });
  const rules = path.join(BRAIN_DIR, "house-rules.md");
  if (!existsSync(rules)) writeFileSync(rules, HOUSE_RULES, "utf-8");
  if (!existsSync(path.join(BRAIN_DIR, ".git"))) {
    await git(["init"]);
    await git(["add", "-A"]);
    await git(["commit", "-m", "init brain"]);
  }
}

export function isInitialized(): boolean {
  return existsSync(path.join(BRAIN_DIR, "house-rules.md"));
}

function listMd(sub: string): string[] {
  const dir = path.join(BRAIN_DIR, sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md") && statSync(path.join(dir, f)).isFile());
}

export function rawFiles(): string[] {
  return readdirSync(path.join(BRAIN_DIR, "0-raw"))
    .filter((f) => !f.startsWith(".") && statSync(path.join(BRAIN_DIR, "0-raw", f)).isFile());
}

export function brainStatus() {
  if (!isInitialized()) return { initialized: false };
  const briefings = listMd("briefings").sort();
  const latest = briefings.at(-1);
  return {
    initialized: true,
    raw: rawFiles().length,
    atoms: listMd("2-atoms").length,
    threads: listMd("3-threads").length,
    briefings: briefings.length,
    latestBriefing: latest ? readFileSync(path.join(BRAIN_DIR, "briefings", latest), "utf-8") : null,
    latestBriefingName: latest ?? null,
  };
}

export async function commitBrain(message: string): Promise<void> {
  await git(["add", "-A"]);
  await git(["commit", "-m", message]);
}

let captureSeq = 0;
export function captureRaw(text: string): string {
  mkdirSync(path.join(BRAIN_DIR, "0-raw"), { recursive: true });
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}-${captureSeq++}`;
  const name = `capture-${stamp}.md`;
  writeFileSync(path.join(BRAIN_DIR, "0-raw", name), text.trim() + "\n", "utf-8");
  return name;
}
