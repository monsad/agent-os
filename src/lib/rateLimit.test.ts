import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimit, clearAllRateLimits, clientKey } from "./rateLimit";

beforeEach(() => clearAllRateLimits());

describe("rateLimit", () => {
  it("allows up to the limit, then blocks", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 60_000, now).ok).toBe(true);
    }
    const blocked = rateLimit("k", 3, 60_000, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
  });

  it("lets attempts through again once the window has passed", () => {
    const now = 1_000_000;
    rateLimit("k", 1, 60_000, now);
    expect(rateLimit("k", 1, 60_000, now).ok).toBe(false);
    expect(rateLimit("k", 1, 60_000, now + 60_001).ok).toBe(true);
  });

  it("keeps separate counters per key", () => {
    const now = 1_000_000;
    rateLimit("a", 1, 60_000, now);
    expect(rateLimit("a", 1, 60_000, now).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000, now).ok).toBe(true);
  });

  it("resetRateLimit clears a key so a success wipes the failure streak", () => {
    const now = 1_000_000;
    rateLimit("k", 1, 60_000, now);
    expect(rateLimit("k", 1, 60_000, now).ok).toBe(false);
    resetRateLimit("k");
    expect(rateLimit("k", 1, 60_000, now).ok).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first x-forwarded-for entry and scopes the key", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientKey(req, "login")).toBe("login:1.2.3.4");
  });

  it("falls back to a local key when no address header is present", () => {
    expect(clientKey(new Request("http://x"), "login")).toBe("login:local");
  });
});
