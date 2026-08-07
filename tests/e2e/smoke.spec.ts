import { test, expect } from "@playwright/test";

// Deliberately fixture-free: these assert the auth gate itself, so they pass on a
// clean checkout with no seeded user and no Ollama running. Anything past the
// gate needs an account, which belongs in a test that owns its own setup.

test("an unauthenticated visitor is sent to the login page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("the login page offers both signing in and first-run registration", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await expect(page.getByText(/register/i)).toBeVisible();
});

test("the API refuses unauthenticated calls instead of redirecting them", async ({ request }) => {
  const res = await request.get("/api/goals");
  expect(res.status()).toBe(401);
});
