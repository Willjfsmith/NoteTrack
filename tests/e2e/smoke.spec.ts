import { test, expect } from "@playwright/test";

/**
 * Smoke tests that exercise the critical paths called out in Prompt 13.
 *
 * These are deliberately thin — they prove the routes load and major
 * interactions wire up. They don't replace integration tests for individual
 * components.
 *
 * To run locally:
 *   1. `pnpm exec playwright install --with-deps chromium` (one-time)
 *   2. populate `.env.local` with Supabase keys for a test project
 *   3. `pnpm exec playwright test`
 */

const PROJECT_CODE = process.env.E2E_PROJECT_CODE ?? "SP-2";

test("public surfaces render", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/NoteTrack/i);

  await page.goto("/styleguide");
  await expect(page.locator("body")).toContainText(/Tone|Avatar|RefChip|Button/);
});

test.describe.skip("authenticated flow", () => {
  // These tests need a logged-in session and are skipped in CI until we add a
  // service-role auth helper. They serve as the playbook for the smoke
  // expectations called out in Prompt 13 (login → create entry → see it; drag
  // a kanban card → see gate entry).

  test("create an entry from the composer and see it in the diary", async ({ page }) => {
    await page.goto(`/p/${PROJECT_CODE}/today`);
    await page.getByPlaceholder(/Log something/).fill("smoke test note");
    await page.keyboard.press("Meta+Enter");
    await expect(page.locator("article")).toContainText("smoke test note");
  });

  test("dragging a pipeline card emits a gate entry", async ({ page }) => {
    await page.goto(`/p/${PROJECT_CODE}/pipelines`);
    const firstCard = page.locator(".cursor-grab").first();
    const targetCol = page.locator("[data-stage-name]").last();
    await firstCard.dragTo(targetCol);

    await page.goto(`/p/${PROJECT_CODE}/today`);
    await expect(page.locator("article").first()).toContainText(/Moved #/);
  });
});
