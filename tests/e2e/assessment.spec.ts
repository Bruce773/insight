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
  await expect(page.locator("details").filter({ hasText: "Your aspiration and timeline" })).not.toHaveAttribute("open", "");
  await expect(page.locator("details").filter({ hasText: "Your skills and reflections" })).not.toHaveAttribute("open", "");
  await page.getByText("Your aspiration and timeline").click();
  await page.getByText("Your skills and reflections").click();
  await expect(page.getByRole("paragraph").filter({ hasText: "Explore a new direction" })).toBeVisible();
  await expect(page.getByRole("paragraph").filter({ hasText: "1–3 years" })).toBeVisible();
  await expect(page.getByRole("paragraph").filter({ hasText: "Organizing events" })).toBeVisible();
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
  await page.getByRole("button", { name: "Generate starter roadmap" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Choose an exact duration" })).toBeVisible();
  expect(catalogRequests).toBe(0);
  await page.getByRole("button", { name: /download and generate ideas/i }).click();
  await expect(page.getByRole("status").filter({ hasText: "Preparing the model… 42%" })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("test-model-complete")));
  await expect(page.getByText(/Personality trait to reflect on: Synthetic domain/)).toContainText("12 / 20");
  await page.getByRole("button", { name: "Choose priority" }).click();
  await page.getByText("Your skills and reflections").click();
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
  await expect(page.getByRole("heading", { name: "Your personality profile" })).toBeVisible();
  await page.getByRole("button", { name: /continue to aspirations/i }).click();
  await page.getByRole("button", { name: /continue to skills/i }).click();
  await page.getByRole("button", { name: /see my plan/i }).click();
  await page.locator("summary").filter({ hasText: "Your personality profile" }).click();
  await expect(page.getByRole("heading", { name: "Your personality profile" })).toBeVisible();
  await page.getByRole("button", { name: /save my plan/i }).click();
  await expect(page.getByText("Plan saved to your account.")).toBeVisible();
  await expect(page.getByRole("button", { name: /open plan/i })).toBeVisible();
  await page.getByRole("button", { name: /open plan/i }).click();
  await expect(page.getByRole("heading", { name: "Your personality profile" })).toBeVisible();
  expect(saved).toMatchObject({ assessment: { instrument: "Mini-IPIP", responses: { "test-1": 5 }, domains: { "Test domain 1": { rawScore: 16 } } } });
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
  await expect(page.getByRole("heading", { name: "Your personality profile" })).toBeVisible();
  await expect(page.locator('.step-content[data-visible="true"]').getByText("Test facet 1", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("insight-guest-plan") ?? "{}").assessment)).toMatchObject({
    domains: { "Test domain 1": { rawScore: 116 } },
    facets: { "Test facet 1": { rawScore: 16 } },
  });
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
  await page.getByText("Your skills and reflections").click();
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

test("guest roadmap survives reload and can be saved after same-browser sign-in", async ({ page }) => {
  let signedIn = false;
  let saved: unknown;
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: signedIn ? { user: { id: "test-user" } } : {} }));
  await page.route("**/api/assessment/results", (route) => {
    if (route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: "saved" } });
    }
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /skip to my plan/i }).click();
  await page.getByLabel("Your aspiration").fill("Synthetic aspiration");
  await page.getByLabel("Exact roadmap duration").fill("6");
  await page.getByRole("button", { name: "Your plan" }).click();
  await page.getByLabel("Add a skill of your own").fill("Synthetic skill");
  await page.getByRole("button", { name: "Add skill" }).click();
  await page.getByLabel("Add your own step").fill("Synthetic action");
  await page.getByLabel("When (months)").fill("3");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByRole("button", { name: "Edit Synthetic action" }).click();
  await page.getByLabel("Notes").fill("Synthetic reminder");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Your plan" }).click();
  await expect(page.getByText("#1 Synthetic skill")).toBeVisible();
  await expect(page.locator(".roadmap-step-toggle")).toContainText("Synthetic action");

  signedIn = true;
  await page.reload();
  await page.getByRole("button", { name: "Your plan" }).click();
  await page.getByRole("button", { name: "Open guest draft" }).click();
  await expect(page.locator(".roadmap-step-toggle")).toContainText("Synthetic action");
  await page.getByRole("button", { name: "Save my plan" }).click();
  await expect(page.getByText("Plan saved to your account.")).toBeVisible();
  expect(saved).toMatchObject({ duration: { amount: 6, unit: "months" }, roadmap: {
    skills: [{ name: "Synthetic skill" }], steps: [{ text: "Synthetic action", at: 3, notes: "Synthetic reminder" }],
  } });
  expect(await page.evaluate(() => localStorage.getItem("insight-guest-plan"))).toBeNull();
});

test("roadmap suggestions are selective and accepted work survives input changes", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: { requestAdapter: async () => ({}) }, configurable: true });
    Object.defineProperty(window, "Worker", { value: class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(request: { type: string }) {
        const result = request.type === "roadmap"
          ? { steps: [{ text: "Synthetic first action", at: 1 }, { text: "Synthetic second action", at: 3 }] }
          : { ideas: [{ skillId: "2.A.1.a", traitId: "" }, { skillId: "2.B.1.a", traitId: "" }] };
        setTimeout(() => this.onmessage?.(new MessageEvent("message", { data: { type: "result", text: JSON.stringify(result) } })), 0);
      }
      terminate() {}
    } });
  });
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/assessment/catalog?type=skill-list", (route) => route.fulfill({ json: { items: [
    { elementId: "2.A.1.a", elementName: "Synthetic skill A" },
    { elementId: "2.B.1.a", elementName: "Synthetic skill B" },
  ] } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Aspirations" }).click();
  await page.getByLabel("Your aspiration").fill("Synthetic aspiration");
  await page.getByLabel("Exact roadmap duration").fill("6");
  await page.getByRole("button", { name: "Your plan" }).click();
  await page.getByRole("button", { name: /download and generate ideas/i }).click();
  await page.getByRole("button", { name: "Choose priority" }).first().click();
  await page.getByRole("button", { name: "Choose priority" }).click();
  await page.getByRole("button", { name: "Move Synthetic skill B up" }).click();
  await expect(page.getByText("#1 Synthetic skill B")).toBeVisible();
  await page.getByRole("button", { name: "Generate starter roadmap" }).click();
  const first = page.locator(".roadmap-item").filter({ hasText: "Synthetic first action" });
  await first.getByRole("button", { name: "Add step" }).click();
  await expect(page.locator(".roadmap-step-toggle")).toContainText("Synthetic first action");
  await expect(page.getByText("Synthetic second action")).toBeVisible();
  await page.getByRole("button", { name: "Edit Synthetic first action" }).click();
  await page.getByLabel("Step title").fill("Edited action");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Aspirations" }).click();
  await page.getByLabel("Your aspiration").fill("Changed aspiration");
  await page.getByRole("button", { name: "Your plan" }).click();
  await expect(page.locator(".roadmap-step-toggle")).toContainText("Edited action");
  await expect(page.getByText("Review after changes").first()).toBeVisible();
  await expect(page.getByText("Synthetic second action")).not.toBeVisible();
  await page.getByRole("button", { name: "Suggest more roadmap steps" }).click();
  await expect(page.locator(".roadmap-step-toggle")).toContainText("Edited action");
  await expect(page.getByText("Synthetic second action")).toBeVisible();
  await page.locator(".roadmap-item").filter({ hasText: "Synthetic second action" }).getByRole("button", { name: "Add step" }).click();
  await page.getByRole("button", { name: "Aspirations" }).click();
  await page.getByLabel("Exact roadmap duration").fill("2");
  await page.getByRole("button", { name: "Your plan" }).click();
  await expect(page.locator(".roadmap-step-toggle").first()).toContainText("Edited action");
  await page.locator(".roadmap-step-toggle").last().click();
  await expect(page.getByText("This step is outside your timeline. Adjust its timing.")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("step cards edit, expand, reorder, and retain notes after reload", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.goto("/");
  await page.getByRole("button", { name: "Aspirations" }).click();
  await page.getByLabel("Exact roadmap duration").fill("6");
  await page.getByRole("button", { name: "Your plan" }).click();
  for (const title of ["First step", "Second step", "Third step"]) {
    await page.getByLabel("Add your own step").fill(title);
    await page.getByRole("button", { name: "Add step", exact: true }).click();
  }
  const cards = page.locator(".roadmap-step");
  const titles = page.locator(".roadmap-step-toggle strong");
  await expect(titles).toHaveText(["First step", "Second step", "Third step"]);
  await expect(cards.first().locator(".roadmap-step-toggle")).toHaveAttribute("aria-expanded", "false");
  expect((await cards.first().boundingBox())?.height).toBeLessThan(80);
  await cards.first().locator(".roadmap-step-toggle").click();
  await expect(cards.first().getByText("No notes yet.")).toBeVisible();
  await page.getByRole("button", { name: "Edit First step" }).click();
  await expect(page.getByLabel("Step title")).toBeFocused();
  await page.getByLabel("Step title").fill("Discarded edit");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(titles.first()).toHaveText("First step");
  await page.getByRole("button", { name: "Edit First step" }).click();
  await page.getByLabel("Step title").fill("Updated step");
  await page.getByLabel("When (months)").first().fill("4");
  await page.getByLabel("Notes").fill("First line\nSecond line");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(titles.first()).toHaveText("Updated step");
  await expect(cards.first()).toContainText("First line");
  await expect(cards.first()).toContainText("months 4");
  await cards.first().locator(".roadmap-step-toggle").click();

  await cards.last().scrollIntoViewIfNeeded();
  const source = await cards.first().locator(".roadmap-drag-handle").boundingBox();
  const target = await cards.last().boundingBox();
  if (!source || !target) throw new Error("Roadmap cards are not visible.");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, source.y + source.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(titles).toHaveText(["Updated step", "Second step", "Third step"]);
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height - 8, { steps: 12 });
  await page.mouse.up();
  await expect(titles).toHaveText(["Second step", "Third step", "Updated step"]);
  await cards.last().locator(".roadmap-step-toggle").click();
  await cards.last().getByRole("button", { name: "Move step 3 up" }).focus();
  await page.keyboard.press("Enter");
  await expect(titles).toHaveText(["Second step", "Updated step", "Third step"]);
  await expect(page.getByText("Updated step moved to position 2 of 3.")).toBeAttached();
  await page.reload();
  await page.getByRole("button", { name: "Your plan" }).click();
  await expect(titles).toHaveText(["Second step", "Updated step", "Third step"]);
  await cards.nth(1).locator(".roadmap-step-toggle").click();
  await expect(cards.nth(1)).toContainText("First line");
  await expect(cards.nth(1)).toContainText("Second line");
  await expect(cards.nth(1)).toContainText("months 4");
});

test.describe("touch roadmap controls", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("dragging a step handle reorders cards on touch devices", async ({ page, context }) => {
    await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
    await page.goto("/");
    await page.getByRole("button", { name: "Your plan" }).click();
    for (const title of ["First touch step", "Second touch step", "Third touch step"]) {
      await page.getByLabel("Add your own step").fill(title);
      await page.getByRole("button", { name: "Add step", exact: true }).click();
    }
    const cards = page.locator(".roadmap-step");
    const titles = page.locator(".roadmap-step-toggle strong");
    await cards.last().scrollIntoViewIfNeeded();
    const source = await cards.last().locator(".roadmap-drag-handle").boundingBox();
    const target = await cards.first().boundingBox();
    if (!source || !target) throw new Error("Roadmap cards are not visible.");
    const from = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
    const to = { x: target.x + target.width / 2, y: target.y + 8 };
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let index = 1; index <= 8; index++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{
        x: from.x + (to.x - from.x) * index / 8,
        y: from.y + (to.y - from.y) * index / 8,
      }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(titles).toHaveText(["Third touch step", "First touch step", "Second touch step"]);
    await cdp.detach();
  });
});

test("step notes do not prevent local roadmap suggestions", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("insight-guest-plan", JSON.stringify({
      version: 1, aspiration: "Synthetic aspiration", horizon: "", occupation: null, ratings: {}, action: "",
      duration: { amount: 6, unit: "months" }, roadmap: {
        skills: [], steps: Array.from({ length: 4 }, (_, index) => ({
          id: `step-${index}`, text: `Synthetic step ${index + 1}`, at: 1, source: "user", notes: "Synthetic notes ".repeat(250),
        })),
      },
    }));
    Object.defineProperty(navigator, "gpu", { value: { requestAdapter: async () => ({}) }, configurable: true });
    Object.defineProperty(window, "Worker", { value: class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(request: unknown) {
        document.documentElement.dataset.notesSentToWorker = String(JSON.stringify(request).includes("Synthetic notes"));
        setTimeout(() => this.onmessage?.(new MessageEvent("message", { data: {
          type: "result", text: JSON.stringify({ steps: [{ text: "Synthetic suggestion", at: 2 }] }),
        } })), 0);
      }
      terminate() {}
    } });
  });
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.goto("/");
  await page.getByRole("button", { name: "Your plan" }).click();
  await page.getByRole("button", { name: "Suggest more roadmap steps" }).click();
  await expect(page.getByText("Synthetic suggestion")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-notes-sent-to-worker", "false");
});

test("an unreadable browser draft is not silently overwritten and can be deleted", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("insight-guest-plan", "invalid draft"));
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: {} }));
  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: "automatic draft storage is paused" })).toBeVisible();
  await page.getByRole("button", { name: "Aspirations" }).click();
  await page.getByLabel("Your aspiration").fill("Unsaved work");
  expect(await page.evaluate(() => localStorage.getItem("insight-guest-plan"))).toBe("invalid draft");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete browser draft" }).click();
  expect(await page.evaluate(() => localStorage.getItem("insight-guest-plan"))).toBeNull();
  await expect(page.getByText("The browser draft was deleted.")).toBeVisible();
});
