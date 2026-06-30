// Per-user session for Agent OS. Edge-safe: uses only Web Crypto + process.env,
// so it runs in Next.js middleware as well as Node route handlers.
//
// A session cookie is "<userId>.<hmac>" where hmac = HMAC-SHA256(userId, secret).
// The signature ties the cookie to a real user id and cannot be forged without
// the secret, so middleware can authenticate statelessly (no DB lookup).

export const SESSION_COOKIE = "agentos_session";

function sessionSecret(): string {
  return process.env.AGENT_OS_SESSION_SECRET || "dev-insecure-secret-change-me";
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

export async function signSession(userId: number): Promise<string> {
  const sig = await hmac(String(userId), sessionSecret());
  return `${userId}.${sig}`;
}

/** Returns the user id if the cookie is a valid, untampered session, else null. */
export async function verifySession(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const idStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(idStr, sessionSecret());
  if (!safeEqual(sig, expected)) return null;
  const id = Number(idStr);
  return Number.isInteger(id) && id > 0 ? id : null;
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
