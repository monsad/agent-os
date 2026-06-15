import { getStore } from "@/lib/ghost";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ entries: await getStore().recentJournal() });
  } catch {
    return Response.json({ entries: [] });
  }
}
