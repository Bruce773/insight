import { describe, expect, it } from "vitest";
import { ideaTraits, parseAspirationIdeas, parseIdeaSkills } from "./aspiration-ideas";
import type { AssessmentResult } from "./assessment";

// Synthetic identifiers and scores test validation, not the quality of any model suggestion.
const skills = parseIdeaSkills({ items: [
  { elementId: "2.A.1.a", elementName: "Example skill" },
  { elementId: "2.B.1.a", elementName: "Another skill" },
] });
const assessment: AssessmentResult = {
  instrument: "Mini-IPIP", responses: {},
  domains: { "Example domain": { rawScore: 12, score: 0.5, count: 4 } }, facets: {},
};
const traits = ideaTraits(assessment);

describe("aspiration idea validation", () => {
  it("resolves only supplied skills and real scores", () => {
    expect(parseAspirationIdeas('{"ideas":[{"skillId":"2.A.1.a","traitId":"d0","prose":"ignored"}]}', skills, traits))
      .toEqual([{ skill: skills[0], trait: traits[0] }]);
    expect(parseAspirationIdeas('{"ideas":[{"skillId":"2.B.1.a","traitId":""}]}', skills, []))
      .toEqual([{ skill: skills[1], trait: null }]);
    expect(parseAspirationIdeas('<think>\n\n</think>\n{"ideas":[{"skillId":"2.A.1.a","traitId":"d0"}]}', skills, traits))
      .toEqual([{ skill: skills[0], trait: traits[0] }]);
  });

  it("rejects unknown, duplicate, missing, or malformed references", () => {
    for (const text of [
      "not JSON", '<think>untrusted text</think>{"ideas":[]}', '{"ideas":[]}', '{"ideas":[{"skillId":"fake","traitId":"d0"}]}',
      '{"ideas":[{"skillId":"2.A.1.a","traitId":"fake"}]}',
      '{"ideas":[{"skillId":"2.A.1.a","traitId":""}]}',
      '{"ideas":[{"skillId":"2.A.1.a","traitId":"d0"},{"skillId":"2.A.1.a","traitId":"d0"}]}',
      '{"ideas":[{"skillId":"2.A.1.a"}]}',
    ]) expect(() => parseAspirationIdeas(text, skills, traits)).toThrow();
    expect(() => parseAspirationIdeas('{"ideas":[{"skillId":"2.A.1.a","traitId":"d0"}]}', skills, [])).toThrow();
  });

  it("rejects empty or conflicting skill catalogs", () => {
    expect(() => parseIdeaSkills({ items: [] })).toThrow();
    expect(() => parseIdeaSkills({ items: [...skills, { ...skills[0], elementName: "Conflict" }] })).toThrow();
    expect(() => parseIdeaSkills({ items: [{ elementId: "1.A.1", elementName: "Not a skill" }] })).toThrow();
  });
});
