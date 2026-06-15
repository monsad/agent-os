import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function appendTurn(
  notesDir: string,
  conversationId: string,
  role: string,
  content: string,
): Promise<void> {
  await mkdir(notesDir, { recursive: true });
  const file = path.join(notesDir, `${safeId(conversationId)}.md`);
  await appendFile(file, `**${role}:** ${content}\n\n`, "utf-8");
}
