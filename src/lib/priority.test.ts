import { describe, it, expect } from "vitest";
import { suggestPriority, daysUntil } from "./priority";

const NOW = new Date("2026-06-30T10:00:00Z");

describe("suggestPriority (business logic)", () => {
  it("flags a near/overdue deadline as high regardless of wording", () => {
    expect(suggestPriority({ title: "tidy desk", deadline: "2026-07-01" }, NOW)).toBe("high");
    expect(suggestPriority({ title: "tidy desk", deadline: "2026-06-29" }, NOW)).toBe("high"); // overdue
  });

  it("uses keyword signals in title + description when no urgent deadline", () => {
    expect(suggestPriority({ title: "URGENT: call bank" }, NOW)).toBe("high");
    expect(suggestPriority({ title: "ship", description: "review this soon" }, NOW)).toBe("medium");
  });

  it("treats a deadline this week as medium", () => {
    expect(suggestPriority({ title: "plan sprint", deadline: "2026-07-05" }, NOW)).toBe("medium");
  });

  it("defaults to low for vague, dateless goals", () => {
    expect(suggestPriority({ title: "someday read a book" }, NOW)).toBe("low");
  });

  it("daysUntil returns null for missing/invalid dates", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("not-a-date", NOW)).toBeNull();
    expect(daysUntil("2026-07-10", NOW)).toBe(10);
  });
});
