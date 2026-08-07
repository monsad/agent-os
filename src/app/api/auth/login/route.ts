import { getStore } from "@/lib/ghost";
import { verifyPassword } from "@/lib/password";
import { signSession, sessionCookie } from "@/lib/auth";
import { rateLimit, resetRateLimit, clientKey } from "@/lib/rateLimit";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request): Promise<Response> {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return Response.json({ error: "username and password required" }, { status: 400 });
  }

  // Limit per client *and* per username, so neither spraying one account from
  // many addresses nor many accounts from one address gets unlimited guesses.
  const keys = [clientKey(request, "login"), `login:user:${username.toLowerCase()}`];
  for (const key of keys) {
    const { ok, retryAfterSec } = rateLimit(key, MAX_ATTEMPTS, WINDOW_MS);
    if (!ok) {
      return Response.json(
        { error: "too many attempts, try again later" },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      );
    }
  }

  try {
    const user = await getStore().getUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return Response.json({ error: "invalid credentials" }, { status: 401 });
    }
    for (const key of keys) resetRateLimit(key);
    const res = Response.json({ user: { id: user.id, username: user.username } });
    res.headers.append("Set-Cookie", sessionCookie(await signSession(user.id)));
    return res;
  } catch (e) {
    // Log the real cause for the operator; don't hand internals (paths, config
    // state, driver errors) to an unauthenticated caller.
    console.error("[auth/login]", e);
    return Response.json({ error: "login failed" }, { status: 500 });
  }
}
