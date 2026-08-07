import { getStore } from "@/lib/ghost";
import { hashPassword } from "@/lib/password";
import { signSession, sessionCookie } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { readJson, invalidJson } from "@/lib/http";

const MIN_PASSWORD_LENGTH = 12;
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

// Registration is open only until the first account exists: this is a
// single-operator app, so /register is a first-run setup step, not a public
// sign-up. Reachable-but-open registration would hand anyone who finds the port
// an account — and accounts are not isolated from each other.
// Set AGENT_OS_ALLOW_REGISTRATION=true to keep it open deliberately.
function registrationForcedOpen(): boolean {
  return process.env.AGENT_OS_ALLOW_REGISTRATION === "true";
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ username?: string; password?: string }>(request);
  if (!body) return invalidJson();

  const { ok, retryAfterSec } = rateLimit(clientKey(request, "register"), MAX_ATTEMPTS, WINDOW_MS);
  if (!ok) {
    return Response.json(
      { error: "too many attempts, try again later" },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const username = body.username?.trim();
  const password = body.password ?? "";
  if (!username || password.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { error: `username required; password min ${MIN_PASSWORD_LENGTH} chars` },
      { status: 400 },
    );
  }

  try {
    const store = getStore();

    if (!registrationForcedOpen() && (await store.countUsers()) > 0) {
      return Response.json(
        {
          error:
            "registration is closed — this instance already has an account. " +
            "Set AGENT_OS_ALLOW_REGISTRATION=true to allow more.",
        },
        { status: 403 },
      );
    }

    if (await store.getUserByUsername(username)) {
      return Response.json({ error: "username taken" }, { status: 409 });
    }
    const user = await store.createUser(username, hashPassword(password));
    const res = Response.json({ user: { id: user.id, username: user.username } }, { status: 201 });
    res.headers.append("Set-Cookie", sessionCookie(await signSession(user.id)));
    return res;
  } catch (e) {
    // Log the real cause for the operator; don't hand internals (paths, config
    // state, driver errors) to an unauthenticated caller.
    console.error("[auth/register]", e);
    return Response.json({ error: "registration failed" }, { status: 500 });
  }
}
