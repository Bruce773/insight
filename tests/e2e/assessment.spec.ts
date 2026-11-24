import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("local-model-download-preference", "declined"));
});

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

test("imported skills include essential and transferable skills but not knowledge", async ({ request }) => {
  const catalog = await request.get("/api/assessment/catalog?type=occupations&q=15-1252.00");
  test.skip(!catalog.ok(), "A configured O*NET catalog is required.");
  const occupations = await catalog.json();
  test.skip(!occupations.items.some((item: { code: string }) => item.code === "15-1252.00"), "The O*NET test occupation is not imported.");
  const response = await request.get("/api/assessment/catalog?type=skills&occupation=15-1252.00");
  expect(response.ok()).toBeTruthy();
  const { items } = await response.json();
  expect(items.some((item: { elementId: string }) => item.elementId.startsWith("2.A."))).toBe(true);
  expect(items.some((item: { elementId: string }) => item.elementId.startsWith("2.B."))).toBe(true);
  expect(items.every((item: { elementId: string }) => /^2\.[AB]\./.test(item.elementId))).toBe(true);
  const listResponse = await request.get("/api/assessment/catalog?type=skill-list");
  expect(listResponse.ok()).toBeTruthy();
  const list = (await listResponse.json()).items as { elementId: string; elementName: string }[];
  expect(list.some((item) => item.elementId.startsWith("2.A."))).toBe(true);
  expect(list.some((item) => item.elementId.startsWith("2.B."))).toBe(true);
  expect(list.every((item) => /^2\.[AB]\./.test(item.elementId) && !!item.elementName)).toBe(true);
  expect(new Set(list.map((item) => item.elementId)).size).toBe(list.length);
});

test("an unavailable assessment still lets a guest make a plan", async ({ page }) => {
  let occupationRequests = 0;
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/assessment/catalog?type=assessment&form=quick", (route) => route.fulfill({
    status: 503, json: { error: "The verified questions for this assessment are unavailable or incomplete." },
  }));
  await page.route("**/api/assessment/catalog?type=occupations**", (route) => {
    occupationRequests++;
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /get started/i }).click();
  await page.getByRole("button", { name: /quick assessment/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: "unavailable or incomplete" })).toBeVisible();
  await page.getByRole("button", { name: /continue without assessment/i }).click();
  await page.getByLabel("Your aspiration").fill("Explore a new direction");
  await expect(page.getByLabel("Occupation or code")).not.toBeVisible();
  await page.waitForTimeout(350);
  expect(occupationRequests).toBe(0);
  await page.getByLabel("Your time horizon").selectOption({ label: "1–3 years" });
  await page.getByRole("button", { name: /continue to skills/i }).click();
  await expect(page.getByLabel("Skills you already have")).toBeVisible();
  await page.getByLabel("Skills you already have").fill("Organizing events");
  await page.getByRole("button", { name: /see my plan/i }).click();
  await expect(page.getByText("Explore a new direction")).toBeVisible();
  await expect(page.getByText("1–3 years")).toBeVisible();
  await expect(page.getByText("Organizing events")).toBeVisible();
  await expect(page.getByText("Your aspiration, your skills, and ideas for what to explore next.")).toBeVisible();
  await expect(page.getByText(/O\*NET/i)).not.toBeVisible();
  await expect(page.getByRole("link", { name: /how it works/i })).toHaveAttribute("href", "/about#local-ai");
});

test("local ideas are opt-in, resolve catalog and score references, and clear after input changes", async ({ page }) => {
  let catalogRequests = 0;
  let saved: unknown;
  const payload = {
    version: 1, aspiration: "Explore new projects", horizon: "", occupation: null, ratings: {}, action: "",
    assessment: { instrument: "Mini-IPIP", responses: {}, domains: { "Synthetic domain": { rawScore: 12, score: 0.5, count: 4 } }, facets: {} },
  };
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: { requestAdapter: async () => ({}) }, configurable: true });
    Object.defineProperty(window, "Worker", { value: class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage() {
        setTimeout(() => this.onmessage?.(new MessageEvent("message", { data: { type: "progress", text: "Loading model", progress: 0.42 } })), 0);
        window.addEventListener("test-model-complete", () => this.onmessage?.(new MessageEvent("message", { data: {
          type: "result", text: JSON.stringify({ ideas: [{ skillId: "2.A.1.a", traitId: "d0" }] }),
        } })), { once: true });
      }
      terminate() {}
    } });
  });
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: "test-user" } } }));
  await page.route("**/api/assessment/results", (route) => {
    if (route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: "saved" } });
    }
    return route.fulfill({ json: { items: [{ id: "saved", createdAt: "2026-01-01", payload: saved ?? payload }] } });
  });
  await page.route("**/api/assessment/catalog?type=occupations**", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/assessment/catalog?type=skill-list", (route) => {
    catalogRequests++;
    return route.fulfill({ json: { items: [{ elementId: "2.A.1.a", elementName: "Synthetic skill" }] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Your plan" }).click();
  await page.getByRole("button", { name: /open plan/i }).click();
  expect(catalogRequests).toBe(0);
  await page.getByRole("button", { name: /download and generate ideas/i }).click();
  await expect(page.getByRole("status").filter({ hasText: "Preparing the model… 42%" })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("test-model-complete")));
  await expect(page.getByText(/Personality trait to reflect on: Synthetic domain/)).toContainText("12 / 20");
  await page.getByRole("button", { name: "Choose priority" }).click();
  await expect(page.getByText("Your chosen priority: Synthetic skill")).toBeVisible();
  await page.getByRole("button", { name: "Save my plan" }).click();
  await expect(page.getByText("Plan saved to your account.")).toBeVisible();
  expect(saved).toMatchObject({ ideaFocus: "Synthetic skill", aspiration: "Explore new projects", occupation: null });
  await page.getByRole("button", { name: "Back to skills" }).click();
  await page.getByLabel("Skills you already have").fill("New skill");
  await page.getByRole("button", { name: /see my plan/i }).click();
  await expect(page.getByText("Your chosen priority: Synthetic skill")).not.toBeVisible();
  await expect(page.getByText(/Personality trait to reflect on: Synthetic domain/)).not.toBeVisible();
  expect(catalogRequests).toBe(1);
});

test("the local model can be removed and downloaded again across tabs", async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: { requestAdapter: async () => ({}) }, configurable: true });
    Object.defineProperty(window, "Worker", { value: class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      async postMessage() {
        const base = "https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f32_1-MLC/resolve/main/";
        const cache = await caches.open("webllm/model");
        await cache.put(`${base}tensor-cache.json`, new Response(JSON.stringify({ records: [{ dataPath: "params.bin" }] })));
        await cache.put(`${base}params.bin`, new Response("synthetic model data"));
        this.onmessage?.(new MessageEvent("message", { data: { type: "model-ready", text: "" } }));
        this.onmessage?.(new MessageEvent("message", { data: {
          type: "result", text: JSON.stringify({ ideas: [{ skillId: "2.A.1.a", traitId: "" }] }),
        } }));
      }
      terminate() {}
    } });
  });
  await context.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await context.route("**/api/assessment/catalog?type=skill-list", (route) =>
    route.fulfill({ json: { items: [{ elementId: "2.A.1.a", elementName: "Synthetic skill" }] } }));
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.setItem("local-model-download-preference", "declined");
    const base = "https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f32_1-MLC/resolve/main/";
    const cache = await caches.open("webllm/model");
    await cache.put(`${base}tensor-cache.json`, new Response(JSON.stringify({ records: [{ dataPath: "params.bin" }] })));
    await cache.put(`${base}params.bin`, new Response("synthetic model data"));
  });
  await page.reload();
  await page.getByRole("button", { name: "Your plan" }).click();
  await expect(page.getByRole("button", { name: "Generate ideas", exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: "Your plan" }).click();
  await expect(second.getByRole("button", { name: "Generate ideas", exact: true })).toBeVisible();

  await page.getByText("Manage local AI model").click();
  await page.getByRole("button", { name: "Remove local model" }).click();
  await page.evaluate(() => {
    const original = Cache.prototype.delete;
    let fail = true;
    Cache.prototype.delete = function (...args) {
      if (fail) {
        fail = false;
        return Promise.reject(new Error("Storage unavailable"));
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Remove model", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Storage unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove model", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove model", exact: true }).click();
  await expect(page.getByText("Manage local AI model")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Download and generate ideas" })).toBeVisible();
  await expect(second.getByRole("button", { name: "Download and generate ideas" })).toBeVisible();
  expect(await page.evaluate(async () => {
    const cache = await caches.open("webllm/model");
    return !!await cache.match("https://huggingface.co/mlc-ai/Qwen3.5-4B-q4f32_1-MLC/resolve/main/params.bin");
  })).toBe(false);

  await page.getByRole("button", { name: "Aspirations" }).click();
  await page.getByLabel("Your aspiration").fill("Explore new projects");
  await page.getByRole("button", { name: "Your plan" }).click();
  await page.getByRole("button", { name: "Download and generate ideas" }).click();
  await expect(page.getByText("Synthetic skill", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate ideas", exact: true })).toBeVisible();
  await expect(second.getByRole("button", { name: "Generate ideas", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Your plan" }).click();
  await expect(page.getByRole("button", { name: "Generate ideas", exact: true })).toBeVisible();
});

test("local ideas explain when WebGPU is unavailable without downloading", async ({ page }) => {
  let catalogRequests = 0;
  await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true }));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/assessment/catalog?type=occupations**", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/assessment/catalog?type=skill-list", (route) => {
    catalogRequests++;
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /skip to my plan/i }).click();
  await page.getByLabel("Your aspiration").fill("Explore a new direction");
  await page.getByRole("button", { name: /continue to skills/i }).click();
  await page.getByRole("button", { name: /see my plan/i }).click();
  await page.getByRole("button", { name: /download and generate ideas/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: "WebGPU is unavailable" })).toBeVisible();
  expect(catalogRequests).toBe(0);
});

test("local ideas stop before downloading when no GPU adapter is available", async ({ page }) => {
  let catalogRequests = 0;
  await page.addInitScript(() => Object.defineProperty(navigator, "gpu", {
    value: { requestAdapter: async () => null }, configurable: true,
  }));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/assessment/catalog?type=occupations**", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/assessment/catalog?type=skill-list", (route) => {
    catalogRequests++;
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /skip to my plan/i }).click();
  await page.getByLabel("Your aspiration").fill("Explore a new direction");
  await page.getByRole("button", { name: /continue to skills/i }).click();
  await page.getByRole("button", { name: /see my plan/i }).click();
  await page.getByRole("button", { name: /download and generate ideas/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No compatible WebGPU adapter" })).toBeVisible();
  expect(catalogRequests).toBe(0);
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
  await expect(page.getByRole("heading", { name: "Your personality traits" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Test domain 1" })).toContainText("16 / 20");
  await page.getByRole("button", { name: /continue to aspirations/i }).click();
  await page.getByRole("button", { name: /continue to skills/i }).click();
  await page.getByRole("button", { name: /see my plan/i }).click();
  await expect(page.getByRole("heading", { name: "Your personality traits" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Your personality traits" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Test domain 1" })).toContainText("116 / 120");
  await page.getByText("View more personality traits").click();
  await expect(page.getByRole("listitem").filter({ has: page.getByText("Test facet 1", { exact: true }) })).toContainText("16 / 20");
});

test("experimental comparison is opt-in and a chosen skill can be saved", async ({ page }) => {
  let workStyleRequests = 0;
  let saved: unknown;
  const facets = Object.fromEntries([
    ["N1: ANXIETY", 0.1], ["C3: DUTIFULNESS", 0.8], ["C5: SELF-DISCIPLINE", 0.8],
    ["A4: COOPERATION", 0.2], ["A6: SYMPATHY", 0.2], ["O1: IMAGINATION", 0.1], ["O5: INTELLECT", 0.3],
  ].map(([label, score]) => [label, { rawScore: 4, score, count: 4 }]));
  const payload = {
    version: 1, aspiration: "", horizon: "", occupation: null, ratings: {}, action: "",
    assessment: { instrument: "IPIP-NEO-120", responses: {}, domains: {}, facets },
  };
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: "test-user" } } }));
  await page.route("**/api/assessment/results", async (route) => {
    if (route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { id: "saved" } });
    } else {
      await route.fulfill({ json: { items: [{ id: "saved", createdAt: "2026-01-01T00:00:00Z", payload }] } });
    }
  });
  await page.route("**/api/assessment/catalog?type=occupations**", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/assessment/catalog?type=skills**", (route) => route.fulfill({ json: {
    items: [{ elementId: "test-skill", elementName: "Synthetic skill", value: 3, source: "Synthetic test data" }],
  } }));
  await page.route("**/api/assessment/catalog?type=workstyles", (route) => {
    workStyleRequests++;
    return route.fulfill({ json: { items: ["Dependability", "Cooperation", "Innovation", "Stress Tolerance"].map((elementName, index) => ({
      code: "test", title: "Synthetic occupation", description: null, jobZone: null,
      elementName, value: [0.8, 0.2, 0.2, 0.9][index],
    })) } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Your plan" }).click();
  await page.getByRole("button", { name: /open plan/i }).click();
  await page.getByRole("button", { name: "Aspirations" }).click();
  await expect(page.getByRole("button", { name: /show experimental comparisons/i })).not.toBeVisible();
  expect(workStyleRequests).toBe(0);
  await page.getByText("Explore a specific occupation").click();
  await expect(page.getByText(/unvalidated comparisons/i)).toBeVisible();
  await page.getByRole("button", { name: /show experimental comparisons/i }).click();
  await page.getByRole("button", { name: /Synthetic occupation/ }).click();
  expect(workStyleRequests).toBe(1);
  await page.getByRole("button", { name: /continue to skills/i }).click();
  await expect(page.locator(".skill-row").filter({ hasText: "Synthetic skill" })).toBeVisible();
  await expect(page.getByText(/Source: Synthetic test data/)).not.toBeVisible();
  await page.getByLabel(/skill you want to focus on/i).selectOption("test-skill");
  await page.getByRole("button", { name: /see my plan/i }).click();
  await expect(page.getByText("Your chosen focus: Synthetic skill")).toBeVisible();
  await page.getByRole("button", { name: /save my plan/i }).click();
  await expect(page.getByText("Plan saved to your account.")).toBeVisible();
  expect(saved).toMatchObject({ focusSkill: "test-skill", occupation: { code: "test" } });
  await page.getByRole("button", { name: "Aspirations" }).click();
  await expect(page.locator("summary").filter({ hasText: "Explore a specific occupation" })).toContainText("Synthetic occupation selected");
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
  await expect(about.getByRole("heading", { name: "Local AI ideas and privacy" })).toBeVisible();
  await about.close();
  await expect(page.getByLabel("Your aspiration")).toHaveValue("Explore a new direction");
});
