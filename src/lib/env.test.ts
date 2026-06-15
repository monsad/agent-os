import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv } from "./env";

describe("getEnv", () => {
  const old = { ...process.env };
  beforeEach(() => { process.env.OLLAMA_BASE_URL = "http://x/v1"; });
  afterEach(() => { process.env = { ...old }; });

  it("returns a configured value", () => {
    expect(getEnv("OLLAMA_BASE_URL")).toBe("http://x/v1");
  });

  it("returns the fallback when unset", () => {
    delete process.env.OLLAMA_MODEL;
    expect(getEnv("OLLAMA_MODEL", "gpt-oss:20b")).toBe("gpt-oss:20b");
  });

  it("throws when unset and no fallback", () => {
    delete process.env.GHOST_DATABASE_URL;
    expect(() => getEnv("GHOST_DATABASE_URL")).toThrow(/GHOST_DATABASE_URL/);
  });
});
