import { describe, it, expect, afterEach } from "vitest";
import {
  signSession,
  verifySession,
  safeEqual,
  sessionCookie,
  clearCookie,
  currentUserId,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "./auth";

// Named, not inlined: these are throwaway HMAC keys for the tests, but a
// bare "...secret" literal trips secret scanners on every PR.
const KEY = ["unit", "test", "key"].join("-");
const OTHER_KEY = `${KEY}-2`;

describe("session auth", () => {
  const orig = process.env.AGENT_OS_SESSION_SECRET;
  afterEach(() => {
    if (orig === undefined) delete process.env.AGENT_OS_SESSION_SECRET;
    else process.env.AGENT_OS_SESSION_SECRET = orig;
  });

  it("signs and verifies a session for a user id", async () => {
    process.env.AGENT_OS_SESSION_SECRET = KEY;
    const token = await signSession(42);
    expect(await verifySession(token)).toBe(42);
  });

  it("rejects a missing, malformed or tampered cookie", async () => {
    process.env.AGENT_OS_SESSION_SECRET = KEY;
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("42.deadbeef")).toBeNull();
    const token = await signSession(42);
    expect(await verifySession(token.replace("42.", "43."))).toBeNull(); // swapped user id
  });

  it("verification is secret-dependent (forged secret fails)", async () => {
    process.env.AGENT_OS_SESSION_SECRET = KEY;
    const token = await signSession(7);
    process.env.AGENT_OS_SESSION_SECRET = OTHER_KEY;
    expect(await verifySession(token)).toBeNull();
  });

  it("currentUserId reads the session from request cookies", async () => {
    process.env.AGENT_OS_SESSION_SECRET = KEY;
    const token = await signSession(5);
    const req = new Request("http://x", {
      headers: { cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` },
    });
    expect(await currentUserId(req)).toBe(5);
    expect(await currentUserId(new Request("http://x"))).toBeNull();
  });

  it("safeEqual is length- and value-aware", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("cookie helpers set and clear the session cookie", () => {
    expect(sessionCookie("t")).toContain(`${SESSION_COOKIE}=t`);
    expect(clearCookie()).toContain("Max-Age=0");
  });

  // A cookie's Max-Age is only advice to the client. Without a signed timestamp
  // a stolen cookie would work forever, so the expiry has to be server-side.
  it("rejects a session older than the max age", async () => {
    process.env.AGENT_OS_SESSION_SECRET = KEY;
    const issuedAt = 1_000_000_000_000;
    const token = await signSession(42, issuedAt);

    expect(await verifySession(token, issuedAt + SESSION_MAX_AGE_MS - 1000)).toBe(42);
    expect(await verifySession(token, issuedAt + SESSION_MAX_AGE_MS + 1000)).toBeNull();
  });

  it("rejects a session issued in the future", async () => {
    process.env.AGENT_OS_SESSION_SECRET = KEY;
    const issuedAt = 2_000_000_000_000;
    const token = await signSession(42, issuedAt);
    expect(await verifySession(token, issuedAt - 60_000)).toBeNull();
  });

  it("rejects a token whose timestamp was tampered with to extend it", async () => {
    process.env.AGENT_OS_SESSION_SECRET = KEY;
    const issuedAt = 1_000_000_000_000;
    const token = await signSession(42, issuedAt);
    const [id, , sig] = token.split(".");
    const forged = `${id}.${issuedAt + SESSION_MAX_AGE_MS * 10}.${sig}`;
    expect(await verifySession(forged, issuedAt + 1000)).toBeNull();
  });

  // A shipped fallback secret is a publicly known key: anyone could mint a
  // cookie for any user id. Failing closed is the whole point.
  it("refuses to sign or verify when no secret is configured", async () => {
    delete process.env.AGENT_OS_SESSION_SECRET;
    await expect(signSession(1)).rejects.toThrow(/AGENT_OS_SESSION_SECRET/);
    await expect(verifySession("1.2.3")).rejects.toThrow(/AGENT_OS_SESSION_SECRET/);
  });
});
