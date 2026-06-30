import { getStore } from "@/lib/ghost";
import { verifyPassword } from "@/lib/password";
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
  if (!username || !password) {
    return Response.json({ error: "username and password required" }, { status: 400 });
  }

  try {
    const user = await getStore().getUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return Response.json({ error: "invalid credentials" }, { status: 401 });
    }
    const res = Response.json({ user: { id: user.id, username: user.username } });
    res.headers.append("Set-Cookie", sessionCookie(await signSession(user.id)));
    return res;
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
