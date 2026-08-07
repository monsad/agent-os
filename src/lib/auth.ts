// Per-user session for Agent OS. Edge-safe: uses only Web Crypto + process.env,
// so it runs in Next.js middleware as well as Node route handlers.
//
// A session cookie is "<userId>.<issuedAt>.<hmac>", where the hmac covers
// "<userId>.<issuedAt>". Signing the timestamp is what makes the lifetime real:
// a cookie's own Max-Age is only advice the client may ignore, so without it a
// stolen cookie stays valid forever.

export const SESSION_COOKIE = "agentos_session";

/** How long a signed session stays valid. Mirrors the cookie's Max-Age. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Deliberately no fallback. A shipped default is a publicly known key — anyone
// could mint a valid cookie for any user id. Failing closed turns that into a
// loud startup error instead of a silent, total authentication bypass.
function sessionSecret(): string {
  const secret = process.env.AGENT_OS_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "AGENT_OS_SESSION_SECRET is not set. Generate one (`openssl rand -hex 32`) and " +
        "put it in .env.local — sessions cannot be signed safely without it.",
    );
  }
  return secret;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

/** Length-checked, early-exit-free comparison so verification does not leak via timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(userId: number, now: number = Date.now()): Promise<string> {
  const payload = `${userId}.${now}`;
  return `${payload}.${await hmac(payload, sessionSecret())}`;
}

/**
 * Returns the user id if the cookie is a valid, untampered, unexpired session,
 * else null. The signature is checked before the age, so an expired token still
 * has to be authentic to be distinguished from a forged one.
 */
export async function verifySession(
  token: string | undefined,
  now: number = Date.now(),
): Promise<number | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idStr, issuedAtStr, sig] = parts;

  const expected = await hmac(`${idStr}.${issuedAtStr}`, sessionSecret());
  if (!safeEqual(sig, expected)) return null;

  const id = Number(idStr);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!Number.isFinite(issuedAt)) return null;

  const age = now - issuedAt;
  // Reject clock-skewed futures too: a token issued "later than now" would
  // otherwise outlive the window.
  if (age < 0 || age > SESSION_MAX_AGE_MS) return null;

  return id;
}

/** Cookie header value for a freshly issued session (7-day, HttpOnly, Lax). */
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

/** Cookie header value that clears the session. */
export function clearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Resolve the logged-in user id from a request's cookies, or null if not authed. */
export async function currentUserId(request: Request): Promise<number | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  return verifySession(decodeURIComponent(match[1]));
}
