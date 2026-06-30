import { describe, it, expect, afterEach } from "vitest";
import {
  signSession,
  verifySession,
  safeEqual,
  sessionCookie,
  clearCookie,
  currentUserId,
  SESSION_COOKIE,
} from "./auth";

describe("session auth", () => {
  const orig = process.env.AGENT_OS_SESSION_SECRET;
  afterEach(() => {
    if (orig === undefined) delete process.env.AGENT_OS_SESSION_SECRET;
    else process.env.AGENT_OS_SESSION_SECRET = orig;
  });

  it("signs and verifies a session for a user id", async () => {
    process.env.AGENT_OS_SESSION_SECRET = "test-secret";
    const token = await signSession(42);
    expect(await verifySession(token)).toBe(42);
  });

  it("rejects a missing, malformed or tampered cookie", async () => {
    process.env.AGENT_OS_SESSION_SECRET = "test-secret";
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("42.deadbeef")).toBeNull();
    const token = await signSession(42);
    expect(await verifySession(token.replace("42.", "43."))).toBeNull(); // swapped user id
  });

  it("verification is secret-dependent (forged secret fails)", async () => {
    process.env.AGENT_OS_SESSION_SECRET = "secret-a";
    const token = await signSession(7);
    process.env.AGENT_OS_SESSION_SECRET = "secret-b";
    expect(await verifySession(token)).toBeNull();
  });

  it("currentUserId reads the session from request cookies", async () => {
    process.env.AGENT_OS_SESSION_SECRET = "test-secret";
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
});
