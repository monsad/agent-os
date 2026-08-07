import { BRAIN_DIR, initBrain, brainStatus } from "@/lib/brain";
import { runClaude } from "@/lib/cliAgent";

// Ask the second brain a question. Read-only by design: the answer may come
// ONLY from what the brain already holds (atoms/threads), never from the
// model's own knowledge — the recall mirror of the night-shift refiner.
export async function POST(request: Request): Promise<Response> {
  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected JSON body" }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question) return Response.json({ error: "no question" }, { status: 400 });

  await initBrain();
  const prompt = `You are the recall interface of a personal "second brain". The working
directory IS the brain. Read house-rules.md first and obey it absolutely.

Answer the question below using ONLY the material in 2-atoms/ and 3-threads/.
Rules:
1. Search the atoms and threads for relevant notes before answering.
2. Every claim in your answer must cite the note file it came from, inline,
   like [2-atoms/some-note.md].
3. If the brain holds nothing relevant, say exactly that — do not answer from
   your own knowledge. Suggest what kind of capture would fill the gap.
4. If atoms contradict each other ([FRICTION] blocks), surface the conflict
   instead of picking a side.
5. Your final reply must BE the complete, self-contained answer with its
   citations. Never refer to "the answer above", your process, or plan mode —
   the user sees only your last message.

Question: ${question}`;

  try {
    const answer = await runClaude([{ role: "user", content: prompt }], undefined, {
      cwd: BRAIN_DIR,
      readOnly: true,
    });
    return Response.json({ answer, ...brainStatus() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "ask failed" }, { status: 503 });
  }
}
