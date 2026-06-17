import { BRAIN_DIR, initBrain, rawFiles, brainStatus, commitBrain } from "@/lib/brain";
import { runClaude } from "@/lib/cliAgent";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(): Promise<Response> {
  await initBrain();
  const raw = rawFiles();
  if (raw.length === 0) return Response.json({ error: "empty_raw" }, { status: 400 });

  const date = today();
  const prompt = `You are the night shift of a personal "second brain". The working
directory IS the brain. Read house-rules.md first and obey it absolutely — especially
the Prime Directive: no source, no note; never invent claims not in the material.

Process EVERY file currently in 0-raw/ (there are ${raw.length}). For each raw capture:
1. Read it (and any file it points to in sources/).
2. Split it into atomic notes — ONE idea per file — written to 2-atoms/ as markdown
   with YAML frontmatter: id, type: atom, certainty, sources: [...], links: [...].
3. Before creating an atom, scan existing 2-atoms/ for one to extend instead.
4. Link each atom to at least two related atoms when any exist.
5. If an atom contradicts an existing note, add a "## [FRICTION] Raised by review"
   block quoting and linking the conflicting note. Never overwrite a belief.
6. After processing, update or create the relevant doc(s) in 3-threads/.
7. Move each handled raw file into 0-raw/archive/.
8. Finally write a briefing to briefings/${date}.md with these sections:
   "### What Came In" (counts), "### Contradictions You Should Resolve" (each FRICTION,
   linked), "### Threads That Grew", "### One Thing Worth Your Attention Today".

Write the files directly. When done, reply with a 2-3 sentence summary of what the
shift produced (sources processed, atoms made, contradictions found).`;

  let summary: string;
  try {
    summary = await runClaude([{ role: "user", content: prompt }], undefined, { cwd: BRAIN_DIR, write: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "refine failed" }, { status: 503 });
  }

  await commitBrain(`night shift ${date}`);
  return Response.json({ summary, ...brainStatus() });
}
