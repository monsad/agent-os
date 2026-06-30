import { getStore } from "@/lib/ghost";
import { hashPassword } from "@/lib/password";
import { signSession, sessionCookie } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password ?? "";
  if (!username || password.length < 6) {
    return Response.json({ error: "username required; password min 6 chars" }, { status: 400 });
  }

  try {
    const store = getStore();
    if (await store.getUserByUsername(username)) {
      return Response.json({ error: "username taken" }, { status: 409 });
    }
    const user = await store.createUser(username, hashPassword(password));
    const res = Response.json({ user: { id: user.id, username: user.username } }, { status: 201 });
    res.headers.append("Set-Cookie", sessionCookie(await signSession(user.id)));
    return res;
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
