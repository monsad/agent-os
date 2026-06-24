import { reviewDiff } from "./agent.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  const diff = (await readStdin()).trim();
  if (!diff) {
    console.error("No diff on stdin. Usage: git diff origin/main | npm run review");
    process.exit(2);
  }

  const review = await reviewDiff({
    title: process.env.PR_TITLE,
    body: process.env.PR_BODY,
    diff,
  });

  console.log(JSON.stringify(review, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
