import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Review } from "./schema.js";
import { SYSTEM_PROMPT, userPrompt } from "./prompt.js";

export type ReviewInput = { title?: string; body?: string; diff: string };

const DEFAULT_MODEL = process.env.REVIEW_MODEL ?? "anthropic/claude-3.5-sonnet";

// Reusable reviewer: diff in → structured /10x-impl-review verdict out.
// Exported so promptfoo evals (M5L3) can call it directly.
export async function reviewDiff(input: ReviewInput, model: string = DEFAULT_MODEL): Promise<Review> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const openrouter = createOpenRouter({ apiKey });

  const { object } = await generateObject({
    model: openrouter(model),
    schema: Review,
    system: SYSTEM_PROMPT,
    prompt: userPrompt(input),
  });
  return object;
}

export { Review } from "./schema.js";
