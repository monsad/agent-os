// Access gate for Agent OS. Edge-safe: only reads process.env and does string
// work, so it can run inside Next.js middleware as well as Node route handlers.

export const SESSION_COOKIE = "agentos_session";

/** The passcode the operator must enter. When unset, the gate is disabled (local dev). */
export function configuredPasscode(): string | undefined {
  const v = process.env.AGENT_OS_PASSCODE;
  return v && v.length > 0 ? v : undefined;
}

/** Whether the access gate is active at all. */
export function gateEnabled(): boolean {
  return configuredPasscode() !== undefined;
}

/** Opaque value stored in the session cookie on success. Set AGENT_OS_SESSION_TOKEN
 *  to a random secret in real use; falls back to a passcode-derived value otherwise. */
export function sessionToken(): string {
  return process.env.AGENT_OS_SESSION_TOKEN || `s:${process.env.AGENT_OS_PASSCODE ?? ""}`;
}

/** Length-checked, early-exit-free comparison so the gate does not leak via timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyPasscode(input: string): boolean {
  const pass = configuredPasscode();
  return pass !== undefined && safeEqual(input, pass);
}

export function isAuthed(cookieValue: string | undefined): boolean {
  if (!gateEnabled()) return true;
  return cookieValue !== undefined && safeEqual(cookieValue, sessionToken());
}
