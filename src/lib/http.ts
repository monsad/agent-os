/**
 * Parse a JSON request body, or null if the request didn't carry valid JSON.
 *
 * Every route was repeating the same six-line try/catch to do this. They already
 * agreed on the response (400 `invalid json`), so this isn't unifying divergent
 * behaviour — it's removing the repetition and giving that shape one home, so a
 * future change to it lands everywhere at once.
 *
 * Returning null rather than a Result keeps the call site to two lines:
 *
 *   const body = await readJson<{ task?: string }>(request);
 *   if (!body) return invalidJson();
 *
 * A literal `null` body is treated as invalid, which is what callers want —
 * no route here has a meaningful use for it.
 */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return ((await request.json()) as T) ?? null;
  } catch {
    return null;
  }
}

/** The shared 400 for a body that wasn't usable JSON. */
export function invalidJson(): Response {
  return Response.json({ error: "invalid json" }, { status: 400 });
}
