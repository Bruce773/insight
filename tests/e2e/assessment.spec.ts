import { expect, test } from "@playwright/test";

// Synthetic UI test data, not assessment source material.
function testForm(mode: "quick" | "full") {
  const count = mode === "quick" ? 20 : 120;
  return {
    mode,
    instrument: mode === "quick" ? "Mini-IPIP" : "IPIP-NEO-120",
    items: Array.from({ length: count }, (_, index) => ({
      id: `test-${index + 1}`,
      text: `Synthetic test item ${index + 1}`,
      domain: `Test domain ${Math.floor(index / (count / 5)) + 1}`,
      facet: mode === "full" ? `Test facet ${Math.floor(index / 4) + 1}` : null,
      reverseKeyed: index === 0,
    })),
  };
}

test("an unavailable assessment still lets a guest make a plan", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/assessment/catalog?type=assessment&form=quick", (route) => route.fulfill({
    status: 503, json: { error: "The verified questions for this assessment are unavailable or incomplete." },
  }));
  await page.route("**/api/assessment/catalog?type=occupations**", (route) => route.fulfill({ json: { items: [] } }));
  await page.goto("/");
  await page.getByRole("button", { name: /get started/i }).click();
  await page.getByRole("button", { name: /quick assessment/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: "unavailable or incomplete" })).toBeVisible();
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

test("quick assessment scores answers and saves them with a signed-in plan", async ({ page }) => {
  let saved: unknown;
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: "test-user" } } }));
  await page.route("**/api/assessment/catalog?type=assessment&form=quick", (route) => route.fulfill({ json: testForm("quick") }));
  await page.route("**/api/assessment/catalog?type=occupations**", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/assessment/results", async (route) => {
    if (route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { id: "test-result" } });
    } else {
      await route.fulfill({ json: { items: saved ? [{ id: "test-result", createdAt: "2026-01-01T00:00:00Z", payload: saved }] : [] } });
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: /get started/i }).click();
  await page.getByRole("button", { name: /quick assessment/i }).click();
  await expect(page.getByText("Question 1 of 20", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /next question/i })).toBeDisabled();
  await page.getByText("Very accurate", { exact: true }).click();
  await expect(page.getByText("Synthetic test item 2", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: /previous question/i }).click();
  await expect(page.getByLabel("Very accurate")).toBeChecked();
  await page.getByText("Very accurate", { exact: true }).click();
  await expect(page.getByText("Question 2 of 20", { exact: false })).toBeVisible();
  for (let index = 2; index <= 20; index++) {
    await page.getByText("Very accurate", { exact: true }).click();
  }
  await expect(page.getByText("Question 20 of 20", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /see assessment results/i }).click();
  await expect(page.getByRole("heading", { name: "Mini-IPIP results" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Test domain 1" })).toContainText("16 / 20");
  await page.getByRole("button", { name: /continue to aspirations/i }).click();
  await page.getByRole("button", { name: /continue to skills/i }).click();
  await page.getByRole("button", { name: /see my plan/i }).click();
  await expect(page.getByRole("heading", { name: "Mini-IPIP results" })).toBeVisible();
  await page.getByRole("button", { name: /save my plan/i }).click();
  await expect(page.getByText("Plan saved to your account.")).toBeVisible();
  await expect(page.getByRole("button", { name: /open plan/i })).toBeVisible();
  await page.getByRole("button", { name: /open plan/i }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Test domain 1" })).toContainText("16 / 20");
  expect(saved).toMatchObject({ assessment: { instrument: "Mini-IPIP", responses: { "test-1": 5 } } });
});

test("full assessment produces domain and facet scores", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/assessment/catalog?type=assessment&form=full", (route) => route.fulfill({ json: testForm("full") }));
  await page.goto("/");
  await page.getByRole("button", { name: /get started/i }).click();
  await page.getByRole("button", { name: /full assessment/i }).click();
  for (let index = 1; index <= 120; index++) {
    await page.getByText("Very accurate", { exact: true }).click();
  }
  await page.getByRole("button", { name: /see assessment results/i }).click();
  await expect(page.getByRole("heading", { name: "IPIP-NEO-120 results" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Test domain 1" })).toContainText("116 / 120");
  await page.getByText("View facet scores").click();
  await expect(page.getByRole("listitem").filter({ has: page.getByText("Test facet 1", { exact: true }) })).toContainText("16 / 20");
});

test("keyboard users can navigate answer choices before advancing", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/assessment/catalog?type=assessment&form=quick", (route) => route.fulfill({ json: testForm("quick") }));
  await page.goto("/");
  await page.getByRole("button", { name: /get started/i }).click();
  await page.getByRole("button", { name: /quick assessment/i }).click();
  await page.getByLabel("Very inaccurate").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Moderately inaccurate")).toBeChecked();
  await expect(page.getByText("Question 1 of 20", { exact: false })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByText("Question 2 of 20", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /previous question/i }).click();
  await expect(page.getByLabel("Moderately inaccurate")).toBeChecked();
});

test("about explains purpose and sources without interrupting guest progress", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/assessment/catalog?type=occupations**", (route) => route.fulfill({ json: { items: [] } }));
  await page.goto("/");
  await expect(page.getByText("Not for hiring or employment decisions.", { exact: false })).not.toBeVisible();
  await page.getByRole("button", { name: /skip to my plan/i }).click();
  await page.getByLabel("Your aspiration").fill("Explore a new direction");

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("navigation", { name: "Account and information" }).getByRole("link", { name: /about insight/i }).click();
  const about = await popupPromise;
  await expect(about).toHaveURL(/\/about$/);
  await expect(about.getByRole("heading", { name: "Purpose and limitations" })).toBeVisible();
  await expect(about.getByText(/not hiring or employment decisions/i)).toBeVisible();
  await expect(about.getByRole("link", { name: /O\*NET® 31.0 Database/ })).toHaveAttribute("href", "https://www.onetcenter.org/database.html");
  await expect(about.getByRole("link", { name: /Creative Commons Attribution 4.0/ })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  await expect(about.getByRole("link", { name: "IPIP scoring key" })).toBeVisible();
  await expect(about.getByRole("link", { name: "IPIP items and keys" })).toBeVisible();
  await about.close();
  await expect(page.getByLabel("Your aspiration")).toHaveValue("Explore a new direction");
});
