import { expect, test } from "@playwright/test";

test("front page renders the masthead, lead story, and side rail", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "VERITY", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /Central Banks Diverge as Fed Holds Rates/i,
      level: 2,
    }),
  ).toBeVisible();
  await expect(page.getByText("Also Compiled Today")).toBeVisible();
  await expect(page.getByText(/Sources Disagree/i)).toBeVisible();
});

test("compiled story page renders the source strip", async ({ page }) => {
  await page.goto("/topic/central-banks-diverge-fed-holds-ecb-cut");
  await expect(page.getByText(/Sources · click to read the original reporting/)).toBeVisible();
  await expect(page.getByText("Reuters")).toBeVisible();
  await expect(page.getByText("Bloomberg")).toBeVisible();
});

test("404 on unknown slug", async ({ page }) => {
  const r = await page.goto("/topic/this-slug-does-not-exist");
  expect(r?.status()).toBe(404);
});
