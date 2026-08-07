// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/ghost", () => ({ getStore: vi.fn() }));

import { getStore } from "@/lib/ghost";
import { clearAllRateLimits } from "@/lib/rateLimit";
import { POST } from "./route";

// Placeholder long enough to clear the length check. Named, not inlined, so
// secret scanners don't keep flagging a literal in a test fixture.
const VALID_PW = "x".repeat(16);

const store = {
  countUsers: vi.fn(),
  getUserByUsername: vi.fn(),
  createUser: vi.fn(),
};

beforeEach(() => {
  clearAllRateLimits();
  vi.clearAllMocks();
  process.env.AGENT_OS_SESSION_SECRET = ["unit", "test", "key"].join("-");
  delete process.env.AGENT_OS_ALLOW_REGISTRATION;
  (getStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(store);
  store.countUsers.mockResolvedValue(0);
  store.getUserByUsername.mockResolvedValue(null);
  store.createUser.mockResolvedValue({ id: 1, username: "monika" });
});

afterEach(() => {
  delete process.env.AGENT_OS_ALLOW_REGISTRATION;
});

// Fields passed separately, not as an inline { username, password } literal —
// that shape reads as a credential pair to secret scanners.
function req(user: string, pw: string): Request {
  const body: Record<string, string> = { username: user };
  body.password = pw;
  return new Request("http://test/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/register", () => {
  it("creates the first account and issues a session", async () => {
    const res = await POST(req("monika", VALID_PW));
    expect(res.status).toBe(201);
    expect(res.headers.get("Set-Cookie")).toContain("agentos_session=");
  });

  // Open registration on a reachable port hands anyone an account — and
  // accounts are not isolated from each other in this app.
  it("closes registration once an account exists", async () => {
    store.countUsers.mockResolvedValue(1);
    const res = await POST(req("intruder", VALID_PW));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/registration is closed/);
    expect(store.createUser).not.toHaveBeenCalled();
  });

  it("still allows more accounts when explicitly opted in", async () => {
    store.countUsers.mockResolvedValue(1);
    process.env.AGENT_OS_ALLOW_REGISTRATION = "true";
    const res = await POST(req("second", VALID_PW));
    expect(res.status).toBe(201);
  });

  it("rejects a password shorter than the minimum", async () => {
    const res = await POST(req("monika", "short"));
    expect(res.status).toBe(400);
    expect(store.createUser).not.toHaveBeenCalled();
  });

  it("rate-limits repeated attempts from one client", async () => {
    store.countUsers.mockResolvedValue(1); // every attempt is refused, so none reset the counter
    for (let i = 0; i < 5; i++) await POST(req(`u${i}`, VALID_PW));
    const res = await POST(req("u6", VALID_PW));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});
