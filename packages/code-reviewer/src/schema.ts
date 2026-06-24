import { z } from "zod";

// The six /10x-impl-review dimensions — the scorecard that protects review from
// "looks tidy → ship it".
export const Dimension = z.enum([
  "plan_adherence",
  "scope_discipline",
  "safety_quality",
  "architecture",
  "pattern_consistency",
  "success_criteria",
]);

export const Severity = z.enum(["critical", "warning", "observation"]);
export const Impact = z.enum(["low", "medium", "high"]);

export const Finding = z.object({
  dimension: Dimension,
  severity: Severity,
  impact: Impact,
  file: z.string().nullable().describe("path:line if locatable, else null"),
  problem: z.string().describe("what is wrong, concretely"),
  suggestion: z.string().describe("the fix, or the question to resolve"),
});

export const DimensionScore = z.object({
  dimension: Dimension,
  verdict: z.enum(["pass", "warn", "fail"]),
  note: z.string().describe("one line of evidence for the verdict"),
});

export const Review = z.object({
  summary: z.string().describe("2-3 sentences: does this change deliver the plan, safely?"),
  scorecard: z.array(DimensionScore).length(6),
  findings: z.array(Finding),
  recommendation: z
    .enum(["merge", "fix_first", "needs_discussion"])
    .describe("merge = safe; fix_first = address findings; needs_discussion = a human decision is required"),
});

export type Review = z.infer<typeof Review>;
