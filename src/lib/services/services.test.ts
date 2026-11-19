import { afterEach, describe, expect, it, vi } from "vitest";
import { createOnetClient, generateReport } from "./index";

const mocks = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mocks.create };
    constructor(options: unknown) { mocks.constructor(options); }
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("O*NET v2", () => {
  it("does not call the network without a key", async () => {
    vi.stubEnv("ONET_API_KEY", "");
    const fetch = vi.fn();
    await expect(createOnetClient({ fetch }).searchOccupations("architect")).rejects.toThrow("ONET_API_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a GET with v2 authentication, JSON and one-based pagination", async () => {
    const body = { start: 21, end: 21, total: 21, occupation: [{ code: "17-1011.00", title: "Architect" }] };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    const result = await createOnetClient({ apiKey: "test-key", fetch }).searchOccupations("building & design", { start: 21, end: 21 });
    expect(result).toEqual(body);
    const [url, init] = fetch.mock.calls[0];
    expect(url.toString()).toBe("https://api-v2.onetcenter.org/online/search?keyword=building+%26+design&start=21&end=21");
    expect(init).toEqual({ method: "GET", headers: { "X-API-Key": "test-key", Accept: "application/json" }, redirect: "error", cache: "no-store" });
  });

  it("validates paths, response shapes and HTTP errors", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ occupation: { code: "17-2051.00", title: "Civil Engineers" }, description: "Design." })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ start: 1, end: 1, total: 1, element: [{ id: "2.A.1.b", name: "Listening", description: "Listen." }] })))
      .mockResolvedValueOnce(new Response("denied", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}"));
    const client = createOnetClient({ apiKey: "key", fetch });
    await expect(client.getOccupation("17-2051.00")).resolves.toMatchObject({ description: "Design." });
    await expect(client.getSkills("17-2051.00", { start: 1, end: 1 })).resolves.toMatchObject({ total: 1 });
    expect(fetch.mock.calls[1][0].toString()).toBe("https://api-v2.onetcenter.org/online/occupations/17-2051.00/summary/skills?start=1&end=1");
    await expect(client.getOccupation("../secret")).rejects.toThrow("Invalid O*NET-SOC code");
    await expect(client.searchOccupations("x", { start: 4, end: 2 })).rejects.toThrow("pagination");
    await expect(client.searchOccupations("x")).rejects.toThrow("HTTP 401");
    await expect(client.searchOccupations("x")).rejects.toThrow("Invalid O*NET page");
  });

  it("retrieves Interest Profiler questions and submits exactly 60 ordered answers", async () => {
    const questions = {
      start: 1, end: 1, total: 60,
      answer_option: [{ value: 1, name: "Strongly Dislike" }],
      question: [{ index: 1, area: "realistic", text: "Build cabinets" }],
    };
    const results = {
      careers: "https://api-v2.onetcenter.org/mnm/interestprofiler/careers",
      result: ["realistic", "investigative", "artistic", "social", "enterprising", "conventional"]
        .map((code) => ({ code, description: "Description", score: 20 })),
    };
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(questions)))
      .mockResolvedValueOnce(new Response(JSON.stringify(results)));
    const client = createOnetClient({ apiKey: "key", fetch });
    await expect(client.getInterestProfilerQuestions({ start: 1, end: 1 })).resolves.toEqual(questions);
    expect(fetch.mock.calls[0][0].toString()).toBe("https://api-v2.onetcenter.org/mnm/interestprofiler/questions?start=1&end=1");
    const answers = "12345".repeat(12);
    await expect(client.scoreInterestProfiler(answers)).resolves.toEqual(results);
    expect(fetch.mock.calls[1][0].toString()).toBe(`https://api-v2.onetcenter.org/mnm/interestprofiler/results?answers=${answers}`);
    for (const bad of [answers.slice(1), `${answers.slice(1)}0`, `${answers}1`]) {
      await expect(client.scoreInterestProfiler(bad)).rejects.toThrow("60 ordered answers");
    }
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed Interest Profiler responses", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("{}"));
    const client = createOnetClient({ apiKey: "key", fetch });
    await expect(client.getInterestProfilerQuestions()).rejects.toThrow("questions response");
    await expect(client.scoreInterestProfiler("1".repeat(60))).rejects.toThrow("results response");
  });
});

describe("report", () => {
  const input = { scores: [{ label: "social", value: 0.3 }, { label: "artistic", value: 0.8 }] };

  it("defaults to score-ordered local template without an SDK call", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "key");
    vi.stubEnv("ANTHROPIC_ENABLED", "true");
    expect(await generateReport(input)).toEqual({ source: "template", text: "Scores\nArtistic: 0.8\nSocial: 0.3" });
    await generateReport(input, { enableAnthropic: true });
    expect(mocks.constructor).not.toHaveBeenCalled();
  });

  it("accepts only a complete permutation and renders only stored numbers", async () => {
    vi.stubEnv("ANTHROPIC_ENABLED", "true");
    mocks.create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: '["0","1"]' }] });
    const result = await generateReport(input, { enableAnthropic: true, apiKey: "key", model: "configured-model" });
    expect(result).toEqual({ source: "anthropic", text: "Scores\nSocial: 0.3\nArtistic: 0.8" });
    expect(mocks.constructor).toHaveBeenCalledWith({ apiKey: "key", maxRetries: 0 });
  });

  it.each([
    '["0","0"]', '["0","2"]', '["0","1","999"]',
    '{"ids":["0","1"],"claim":"100 percent"}', '["0","1"]\n100',
  ])("falls back on invalid or injected model output %s", async (text) => {
    vi.stubEnv("ANTHROPIC_ENABLED", "true");
    mocks.create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text }] });
    expect((await generateReport(input, { enableAnthropic: true, apiKey: "key", model: "model" })).text)
      .toBe("Scores\nArtistic: 0.8\nSocial: 0.3");
  });

  it("falls back on SDK failure and rejects untrusted labels or nonfinite scores", async () => {
    vi.stubEnv("ANTHROPIC_ENABLED", "true");
    mocks.create.mockRejectedValue(new Error("network"));
    expect((await generateReport(input, { enableAnthropic: true, apiKey: "key", model: "model" })).source).toBe("template");
    await expect(generateReport({ scores: [{ label: "three", value: 3 }] })).rejects.toThrow("supported score label");
    await expect(generateReport({ scores: [{ label: "social", value: Infinity }] })).rejects.toThrow("finite");
  });

  it.each(["", "false", "TRUE"])("requires an explicit true environment flag (%s)", async (flag) => {
    vi.stubEnv("ANTHROPIC_ENABLED", flag);
    const result = await generateReport(input, { enableAnthropic: true, apiKey: "key", model: "model" });
    expect(result.source).toBe("template");
    expect(mocks.constructor).not.toHaveBeenCalled();
  });
});
