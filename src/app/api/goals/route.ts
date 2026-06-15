import { getStore } from "@/lib/ghost";

export async function GET(): Promise<Response> {
  try {
    return Response.json({ goals: await getStore().listGoals() });
  } catch {
    return Response.json({ goals: [] });
  }
}
