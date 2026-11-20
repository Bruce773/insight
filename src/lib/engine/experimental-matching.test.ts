import { describe, expect, it } from "vitest";
import { experimentalMatches, type WorkStyleRow } from "./experimental-matching";
import type { AssessmentResult } from "./assessment";

// Synthetic scores and occupations test the mechanics, not the crosswalk's validity.
const scores: AssessmentResult = {
  instrument: "IPIP-NEO-120",
  responses: {},
  domains: {},
  facets: Object.fromEntries(([
    ["N1: ANXIETY", 0.1], ["C3: DUTIFULNESS", 0.8], ["C5: SELF-DISCIPLINE", 0.8],
    ["A4: COOPERATION", 0.2], ["A6: SYMPATHY", 0.2],
    ["O1: IMAGINATION", 0.1], ["O5: INTELLECT", 0.3],
  ] as const).map(([name, score]) => [name, { score, rawScore: 0, count: 4 }])),
};

function rows(code: string, values: number[]): WorkStyleRow[] {
  return ["Dependability", "Cooperation", "Innovation", "Stress Tolerance"].map((elementName, index) => ({
    code, title: code, description: null, jobZone: null, elementName, value: values[index],
  }));
}

describe("experimental work-style matching", () => {
  it("ranks complete comparable occupations using the placeholder crosswalk", () => {
    const matches = experimentalMatches(scores, [
      ...rows("opposite", [0.2, 0.8, 0.8, 0.1]),
      ...rows("similar", [0.8, 0.2, 0.2, 0.9]),
      ...rows("constant", [0.5, 0.5, 0.5, 0.5]),
      ...rows("incomplete", [0.8, 0.2, 0.2, 0.9]).slice(0, 3),
      ...rows("duplicate", [0.8, 0.2, 0.2, 0.9]),
      ...rows("duplicate", [0.8, 0.2, 0.2, 0.9]).slice(0, 1),
    ]);
    expect(matches.map((match) => match.occupation.code)).toEqual(["similar", "opposite"]);
    expect(matches[0].score).toBeCloseTo(1);
    expect(matches[1].score).toBeCloseTo(0);
  });

  it("requires the full assessment and every mapped facet", () => {
    expect(() => experimentalMatches({ ...scores, instrument: "Mini-IPIP" }, [])).toThrow(/full assessment/i);
    expect(() => experimentalMatches({ ...scores, facets: {} }, [])).toThrow(/incomplete/i);
    expect(() => experimentalMatches({ ...scores, facets: {
      ...scores.facets, "N1: ANXIETY": { rawScore: 1, score: 0.1, count: 3 },
    } }, [])).toThrow(/incomplete/i);
  });
});
