import { SESSION_COOKIE, sessionToken, verifyPasscode } from "@/lib/auth";

export async function POST(request: Request): Promise<Response> {
  let body: { passcode?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.passcode || !verifyPasscode(body.passcode)) {
    return Response.json({ error: "invalid passcode" }, { status: 401 });
  }

  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(sessionToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`,
  );
  return res;
}
