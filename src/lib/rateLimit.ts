// Fixed-window rate limiter, in memory. Enough for a single-operator app: the
// process is the whole deployment, so there is no second instance to share
// state with. Not a substitute for a real limiter if this ever runs clustered.
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

/**
 * Counts one attempt against `key`. Returns ok:false once `limit` attempts have
 * been made inside `windowMs`, with the seconds left until the window resets.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const w = windows.get(key);

  if (!w || now >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  w.count += 1;
  if (w.count > limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - w.count, retryAfterSec: 0 };
}

/** Drops the counter for a key — call after a success so one win clears the streak. */
export function resetRateLimit(key: string): void {
  windows.delete(key);
}

/** Test seam: forget every window. */
export function clearAllRateLimits(): void {
  windows.clear();
}

/**
 * Best-effort client identity for limiting. Behind a proxy this is spoofable via
 * x-forwarded-for, which is acceptable here: the app is meant to be reached
 * directly on localhost, and the limiter is defence in depth, not a boundary.
 */
export function clientKey(request: Request, scope: string): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${scope}:${fwd || request.headers.get("x-real-ip") || "local"}`;
}
