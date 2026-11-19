import { expect, test } from "@playwright/test";

test("quick assessment blocks without verified source material and a guest can make a plan", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/assessment/catalog?type=status", (route) => route.fulfill({ json: { itemCount: 0, instruments: [] } }));
  await page.route("**/api/assessment/catalog?type=occupations**", (route) => route.fulfill({ json: { items: [] } }));
  await page.goto("/");
  await page.getByRole("button", { name: /get started/i }).click();
  await page.getByRole("button", { name: /quick assessment/i }).click();
  await expect(page.getByText("Quick assessment unavailable")).toBeVisible();
  await expect(page.getByText(/No assessment questions have been imported/)).toBeVisible();
  await page.getByRole("button", { name: /continue without assessment/i }).click();
  await page.getByLabel("Your aspiration").fill("Explore a new direction");
  await page.getByLabel("Your time horizon").selectOption({ label: "1–3 years" });
  await page.getByRole("button", { name: /continue to skills/i }).click();
  await expect(page.getByText("No occupation selected")).toBeVisible();
  await page.getByRole("button", { name: /see my plan/i }).click();
  await expect(page.getByText("Explore a new direction")).toBeVisible();
  await expect(page.getByText("1–3 years")).toBeVisible();
  await expect(page.getByText(/not a scored assessment or an occupation match/)).toBeVisible();
});
