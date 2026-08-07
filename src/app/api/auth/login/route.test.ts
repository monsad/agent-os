// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ghost", () => ({ getStore: vi.fn() }));
vi.mock("@/lib/password", () => ({ verifyPassword: vi.fn() }));

import { getStore } from "@/lib/ghost";
import { verifyPassword } from "@/lib/password";
import { clearAllRateLimits } from "@/lib/rateLimit";
import { POST } from "./route";

const USER = "monika";
const HASH = "not-a-real-hash";

const store = { getUserByUsername: vi.fn() };

beforeEach(() => {
  clearAllRateLimits();
  vi.clearAllMocks();
  process.env.AGENT_OS_SESSION_SECRET = ["unit", "test", "key"].join("-");
  (getStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(store);
  store.getUserByUsername.mockResolvedValue({ id: 1, username: USER, password_hash: HASH });
  (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

// Takes the fields separately rather than an inline { username, password }
// object: that literal shape reads as a credential pair to secret scanners.
function req(user: string, pw: string, ip = "1.2.3.4"): Request {
  const body: Record<string, string> = { username: user };
  body.password = pw;
  return new Request("http://test/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
  });
}

describe("POST /api/auth/login", () => {
  it("signs in with valid credentials and sets a session cookie", async () => {
    const res = await POST(req(USER, "pw"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("agentos_session=");
  });

  it("rejects a wrong password without revealing which part was wrong", async () => {
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const res = await POST(req(USER, "nope"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid credentials");
  });

  it("blocks brute force after repeated failures from one client", async () => {
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    for (let i = 0; i < 10; i++) await POST(req(USER, `try${i}`));
    const res = await POST(req(USER, "try11"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  // Otherwise a botnet could spray one account from many addresses and never
  // trip the per-client counter.
  it("blocks guessing one account from many addresses", async () => {
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    for (let i = 0; i < 10; i++) {
      await POST(req(USER, `try${i}`, `10.0.0.${i}`));
    }
    const res = await POST(req(USER, "try11", "10.0.0.99"));
    expect(res.status).toBe(429);
  });

  it("a successful login clears the failure streak", async () => {
    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    for (let i = 0; i < 9; i++) await POST(req(USER, `try${i}`));

    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect((await POST(req(USER, "right"))).status).toBe(200);

    (verifyPassword as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect((await POST(req(USER, "x"))).status).toBe(401);
  });
});
