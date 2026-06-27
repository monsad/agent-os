import { describe, it, expect, afterEach } from "vitest";
import { verifyPasscode, isAuthed, gateEnabled, sessionToken, safeEqual, SESSION_COOKIE } from "./auth";

describe("access gate", () => {
  const pass = process.env.AGENT_OS_PASSCODE;
  const token = process.env.AGENT_OS_SESSION_TOKEN;
  afterEach(() => {
    if (pass === undefined) delete process.env.AGENT_OS_PASSCODE;
    else process.env.AGENT_OS_PASSCODE = pass;
    if (token === undefined) delete process.env.AGENT_OS_SESSION_TOKEN;
    else process.env.AGENT_OS_SESSION_TOKEN = token;
  });

  it("is open (disabled) when no passcode is configured", () => {
    delete process.env.AGENT_OS_PASSCODE;
    expect(gateEnabled()).toBe(false);
    expect(isAuthed(undefined)).toBe(true);
  });

  it("rejects a wrong passcode and accepts the configured one", () => {
    process.env.AGENT_OS_PASSCODE = "open-sesame";
    expect(verifyPasscode("nope")).toBe(false);
    expect(verifyPasscode("open-sesame")).toBe(true);
  });

  it("authorizes only a request carrying the session token", () => {
    process.env.AGENT_OS_PASSCODE = "open-sesame";
    process.env.AGENT_OS_SESSION_TOKEN = "secret-token";
    expect(isAuthed(undefined)).toBe(false);
    expect(isAuthed("forged")).toBe(false);
    expect(isAuthed(sessionToken())).toBe(true);
  });

  it("safeEqual is length-aware and value-aware", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("exposes a stable cookie name", () => {
    expect(SESSION_COOKIE).toBe("agentos_session");
  });
});
