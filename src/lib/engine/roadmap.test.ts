import { describe, expect, it } from "vitest";
import { isDuration, isRoadmap, markRoadmapForReview, parseStepSuggestions, type Roadmap } from "./roadmap";

const duration = { amount: 6, unit: "months" } as const;
const roadmap: Roadmap = {
  skills: [{ id: "skill", name: "Synthetic skill", source: "ai" }],
  steps: [{ id: "step", text: "Synthetic action", at: 2, source: "user" }],
};

describe("roadmap validation", () => {
  it("accepts bounded whole-number durations and rejects invalid ones", () => {
    expect(isDuration(duration)).toBe(true);
    for (const amount of [0, -1, 1.5, 1001]) expect(isDuration({ amount, unit: "months" })).toBe(false);
    expect(isDuration({ amount: 1, unit: "days" })).toBe(false);
  });

  it("validates saved roadmap shape and preserves edits when marking for review", () => {
    expect(isRoadmap(roadmap)).toBe(true);
    expect(isRoadmap({ ...roadmap, steps: [{ ...roadmap.steps[0], id: "skill" }] })).toBe(false);
    expect(isRoadmap({ ...roadmap, steps: [{ ...roadmap.steps[0], at: -1 }] })).toBe(false);
    expect(markRoadmapForReview(roadmap)).toEqual({
      skills: [{ ...roadmap.skills[0], review: true }],
      steps: [{ ...roadmap.steps[0], review: true }],
    });
    expect(roadmap.steps[0].review).toBeUndefined();
  });

  it("accepts only well-formed suggestions within the selected timeline", () => {
    expect(parseStepSuggestions('<think></think>{"steps":[{"text":"  Try an action  ","at":6}]}', duration))
      .toEqual([{ text: "Try an action", at: 6 }]);
    for (const text of [
      "bad JSON", '{"steps":[]}', '{"steps":[{"text":"", "at":1}]}',
      '{"steps":[{"text":"Example", "at":0}]}', '{"steps":[{"text":"Example", "at":7}]}',
      '{"steps":[{"text":"Example", "at":1.5}]}', '{"steps":[{"text":"Example"}]}',
    ]) expect(() => parseStepSuggestions(text, duration)).toThrow();
  });
});
