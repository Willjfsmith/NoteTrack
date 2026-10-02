import { test, expect } from "@playwright/test";

/**
 * Thin smoke tests for the public surfaces. Authenticated flows need a Supabase
 * project and a signed-in session, so they are exercised manually for now.
 */
test("landing renders and links to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/NoteTrack/i);
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByPlaceholder("you@company.com")).toBeVisible();
});

test("workspace routes redirect to login when signed out", async ({ page }) => {
  await page.goto("/w");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fw/);
});
