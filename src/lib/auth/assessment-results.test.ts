import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  table: { id: "assessment-results.id" },
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { insert: mocks.insert } }));
vi.mock("@/lib/db/schema", () => ({ assessmentResults: mocks.table }));

import { POST } from "@/app/api/assessment/results/route";

function request(body: string) {
  return new Request("https://insight.example/api/assessment/results", {
    method: "POST", headers: { origin: "https://insight.example" }, body,
  });
}

describe("saving plans with step notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", "postgres://test");
    mocks.auth.mockResolvedValue({ user: { id: "test-user" } });
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockReturnValue({ returning: mocks.returning });
    mocks.returning.mockResolvedValue([{ id: "saved" }]);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("accepts a full roadmap with maximum-length notes", async () => {
    const plan = {
      version: 1, aspiration: "", horizon: "", occupation: null, ratings: {}, action: "",
      roadmap: {
        skills: Array.from({ length: 100 }, (_, index) => ({ id: `skill-${index}`, name: "s".repeat(200), source: "user" })),
        steps: Array.from({ length: 100 }, (_, index) => ({ id: `step-${index}`, text: "t".repeat(500), at: 1, notes: "n".repeat(4000), source: "user" })),
      },
    };
    const body = JSON.stringify(plan);
    expect(body.length).toBeGreaterThan(100_000);
    expect((await POST(request(body))).status).toBe(201);
    expect(mocks.values).toHaveBeenCalledWith({ userId: "test-user", payload: plan });
  });

  it("still rejects oversized plans", async () => {
    const response = await POST(request(JSON.stringify({ value: "x".repeat(600_000) })));
    expect(response.status).toBe(413);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
