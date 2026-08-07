import { spawn } from "node:child_process";
import { getRepo } from "@/lib/repo";
import { runCliAgent } from "@/lib/cliAgent";
import { CLI_ROSTER } from "@/lib/roster";
import { timedRun, newBatchId } from "@/lib/runs";
import { readJson, invalidJson } from "@/lib/http";

// Heterogeneous reviewers — each agent gets a DIFFERENT lens, which is the
// whole point: four reviewers with the same prompt is one reviewer with a
// bigger bill; different lenses surface bugs no single pass would.
// Gemini excluded — Google retired the free Gemini Code Assist CLI tier. Its
// readability/tests lens is folded into Claude's correctness lens.
// Membership comes from the shared roster; the lens is this feature's own
// concern — each agent reviews the same diff through a different one, because
// different lenses surface bugs no single pass would.
const LENSES: Record<string, string> = {
  claude:
    "correctness & logic bugs: off-by-one, null/undefined, bad error handling, broken edge cases, wrong control flow — and test changes that weaken or delete assertions to fake a green check",
  codex:
    "security: injection, secrets in code, unsafe/untrusted input, auth mistakes, and untrusted text flowing into an LLM/prompt",
  openclaw:
    "architecture & simplification: duplication, dead code, over-engineering, something that already exists, needless complexity",
};

const REVIEWERS = CLI_ROSTER.map((a) => ({ ...a, lens: LENSES[a.id] ?? "general code review" }));

const MAX_DIFF = 16000;

function gitDiff(repo: string, mode: string, ref?: string): Promise<string> {
  // working: everything uncommitted vs HEAD. branch: changes vs another branch.
  const args =
    mode === "branch"
      ? ["-C", repo, "diff", ref && ref.trim() ? ref.trim() : "main"]
      : ["-C", repo, "diff", "HEAD"];
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    proc.stdout?.on("data", (d) => { out += d.toString(); });
    proc.stderr?.on("data", (d) => { err += d.toString(); });
    proc.on("error", (e) => reject(new Error(`git failed: ${e.message}`)));
    proc.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`git diff failed: ${err || out}`))));
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ mode?: string; ref?: string }>(request);
  if (!body) return invalidJson();
  const repoPath = getRepo().repoPath;
  if (!repoPath) return Response.json({ error: "no_repo" }, { status: 400 });

  const mode = body.mode === "branch" ? "branch" : "working";
  let diff: string;
  try {
    diff = await gitDiff(repoPath, mode, body.ref);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "git failed" }, { status: 400 });
  }
  if (!diff.trim()) return Response.json({ error: "empty_diff" }, { status: 400 });

  const truncated = diff.length > MAX_DIFF;
  const clipped = truncated ? diff.slice(0, MAX_DIFF) + "\n…[diff truncated]" : diff;

  const batchId = newBatchId();
  const findings = await Promise.all(
    REVIEWERS.map(async (r) => {
      const prompt = `You are a code reviewer. Review ONLY for: ${r.lens}.
Be concrete and concise: list each issue as "- file:line — problem — suggested fix".
If you find nothing in your area, reply exactly "No issues found in this area."
Do not summarize the whole diff. Here is the diff to review:

${clipped}`;
      try {
        const review = await timedRun(
          { feature: "review", agent: r.name, backend: r.backend, task: `${mode} diff · ${r.lens.split(":")[0]}`, repo: repoPath, batchId },
          () => runCliAgent(r.backend, [{ role: "user", content: prompt }], undefined, { cwd: repoPath, readOnly: true, timeoutMs: 300_000 }),
        );
        return { id: r.id, name: r.name, lens: r.lens, review, ok: true };
      } catch (e) {
        return { id: r.id, name: r.name, lens: r.lens, review: e instanceof Error ? e.message : "failed", ok: false };
      }
    }),
  );

  return Response.json({ repo: repoPath, mode, truncated, findings });
}
