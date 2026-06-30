// Business logic: suggest a goal's priority from its name, description and
// deadline — no AI call, deterministic and testable. Used when a goal is created.

export type Priority = "high" | "medium" | "low";

export type PriorityInput = {
  title: string;
  description?: string | null;
  deadline?: string | null; // ISO date (YYYY-MM-DD) or null
};

const HIGH_WORDS = ["urgent", "asap", "today", "critical", "now", "blocker", "deadline", "important"];
const MEDIUM_WORDS = ["soon", "this week", "tomorrow", "review", "follow up", "follow-up"];

/** Whole days from today until the deadline (date-only, UTC), or null when absent/invalid.
 *  `now` is injectable for tests. */
export function daysUntil(deadline: string | null | undefined, now: Date): number | null {
  if (!deadline) return null;
  const target = new Date(`${deadline}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Suggest a priority. A near/overdue deadline dominates; otherwise keyword signals
 * in the title + description decide. Defaults to "low".
 */
export function suggestPriority(input: PriorityInput, now: Date = new Date()): Priority {
  const text = `${input.title} ${input.description ?? ""}`.toLowerCase();
  const days = daysUntil(input.deadline, now);

  if (days !== null && days <= 2) return "high"; // due within 2 days (or overdue)
  if (HIGH_WORDS.some((w) => text.includes(w))) return "high";
  if (days !== null && days <= 7) return "medium"; // due this week
  if (MEDIUM_WORDS.some((w) => text.includes(w))) return "medium";
  return "low";
}
