import { describe, expect, it } from "vitest";
import {
  aspirationFit,
  interestFit,
  mapFacetsToWorkStyles,
  mergeSkillPriorities,
  pearsonCorrelation,
  rankOccupations,
  scorePersonality,
  scoreRiasec,
} from "./index";
import placeholder from "../../../data/mappings/facet-to-workstyle.json";
import { scoreAssessment, type AssessmentForm } from "./assessment";

describe("assessment scoring", () => {
  it("normalizes, reverses and aggregates answered personality items with optional norms", () => {
    const result = scorePersonality([
      { id: "a", facet: "order", domain: "conscientiousness" },
      { id: "b", facet: "order", domain: "conscientiousness", reverseKeyed: true },
      { id: "c", facet: "drive", domain: "conscientiousness", min: 0, max: 10 },
      { id: "unanswered", facet: "other", domain: "other" },
    ], { a: 5, b: 2, c: 5 }, {
      facets: { order: { mean: 6, standardDeviation: 2, count: 2 } },
    });
    expect(result.facets.order.rawScore).toBe(9);
    expect(result.facets.order.score).toBe(0.875);
    expect(result.facets.order.zScore).toBe(1.5);
    expect(result.facets.order.percentile).toBeCloseTo(93.319, 2);
    expect(result.facets.drive.score).toBe(0.5);
    expect(result.facets.drive.rawScore).toBe(5);
    expect(result.facets.drive.percentile).toBeUndefined();
    expect(result.domains.conscientiousness.score).toBe(0.75);
    expect(result.facets.other).toBeUndefined();
  });

  it("rejects malformed ranges, duplicate ids, invalid responses and invalid norms", () => {
    const item = { id: "a", facet: "f", domain: "d" };
    expect(() => scorePersonality([item, item], {})).toThrow();
    expect(() => scorePersonality([{ ...item, min: 5, max: 5 }], {})).toThrow();
    expect(() => scorePersonality([item], { a: 6 })).toThrow();
    expect(() => scorePersonality([item], { a: 3 }, { facets: { f: { mean: 0, standardDeviation: 0 } } })).toThrow();
    expect(scorePersonality([item], { a: 3 }, {
      facets: { f: { mean: 5, standardDeviation: 1, count: 2 } },
    }).facets.f.percentile).toBeUndefined();
  });

  it("scores only answered RIASEC dimensions and validates dimensions", () => {
    const result = scoreRiasec([
      { id: "r", dimension: "realistic" },
      { id: "i", dimension: "investigative", reverseKeyed: true },
      { id: "s", dimension: "social" },
    ], { r: 5, i: 1 });
    expect(result.realistic).toEqual({ rawScore: 5, score: 1, count: 1 });
    expect(result.investigative?.score).toBe(1);
    expect(result.social).toBeUndefined();
    expect(() => scoreRiasec([{ id: "x", dimension: "unknown" as never }], {})).toThrow();
  });

  it("scores a completed assessment without inventing facets for domain-only items", () => {
    const form: AssessmentForm = {
      mode: "quick",
      instrument: "Synthetic test form",
      items: [
        { id: "a", text: "Test item A", domain: "test", facet: null, reverseKeyed: false },
        { id: "b", text: "Test item B", domain: "test", facet: null, reverseKeyed: true },
      ],
    };
    const result = scoreAssessment(form, { a: 5, b: 2 });
    expect(result.domains.test).toMatchObject({ rawScore: 9, count: 2 });
    expect(result.facets).toEqual({});
    expect(result.responses).toEqual({ a: 5, b: 2 });
    expect(() => scoreAssessment(form, { a: 5 })).toThrow();
    expect(() => scoreAssessment(form, { a: 5, b: 2, extra: 3 })).toThrow();
    expect(() => scoreAssessment(form, { a: 5, b: 2.5 })).toThrow();
    expect(() => scoreAssessment(form, { a: 5, b: 0 })).toThrow();
    expect(() => scoreAssessment({ ...form, items: [form.items[0], form.items[0]] }, { a: 5 })).toThrow();
  });
});

describe("similarity and work styles", () => {
  it("computes Pearson correlation and reports undefined correlations as null", () => {
    expect(pearsonCorrelation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearsonCorrelation([1, 1], [1, 2])).toBeNull();
    expect(pearsonCorrelation([1], [2])).toBeNull();
    expect(pearsonCorrelation([1, NaN], [1, 2])).toBeNull();
    expect(() => pearsonCorrelation([1], [])).toThrow();
    expect(interestFit({ a: 0, b: 1 }, { a: 1, b: 0 })).toBe(0);
    expect(interestFit({ a: 0, b: 1 }, { a: 0, b: 1 })).toBe(1);
    expect(interestFit({ a: 1 }, { a: 1 })).toBeNull();
  });

  it("uses only supplied facets and supports reverse weights", () => {
    const scores = mapFacetsToWorkStyles({ anxiety: 0.8, self_discipline: 1 }, placeholder.mapping);
    expect(scores["Stress Tolerance"]).toBeCloseTo(0.2);
    expect(scores.Dependability).toBe(1);
    expect(scores.Innovation).toBeUndefined();
    expect(() => mapFacetsToWorkStyles({ anxiety: 2 }, placeholder.mapping)).toThrow();
  });
});

describe("occupation ranking", () => {
  it("filters occupations outside the Job Zone horizon except explicit aspirations", () => {
    const result = rankOccupations({
      riasec: { realistic: 1, social: 0 },
      aspirations: [{ title: "  Software   Developer ", rank: 2 }],
      jobZones: [4],
    }, [
      { code: "a", title: "Software Developer", jobZone: 4, riasec: { realistic: 1, social: 0 } },
      { code: "b", title: "Counselor", jobZone: 3, riasec: { realistic: 0, social: 1 } },
      { code: "c", title: "Software Developer", jobZone: 3 },
    ], { riasec: 2, aspirations: 2, workStyles: 0 });
    expect(result.map((match) => match.occupation.code)).toEqual(["a", "c", "b"]);
    expect(result[0].components).toEqual({ riasec: 1, workStyles: null, aspirations: 0.5 });
    expect(result[0].score).toBeCloseTo(0.75);
  });

  it("includes zones up to the selected horizon and preserves missing zones and aspirations", () => {
    const result = rankOccupations({
      jobZones: [1, 3],
      aspirations: [{ title: "Named", rank: 1 }],
    }, [
      { code: "lower", title: "Lower", jobZone: 2 },
      { code: "equal", title: "Equal", jobZone: 3 },
      { code: "higher", title: "Higher", jobZone: 4 },
      { code: "named", title: "Named", jobZone: 5 },
      { code: "null", title: "Null", jobZone: null },
      { code: "missing", title: "Missing" },
    ]);
    expect(result.map((match) => match.occupation.code).sort()).toEqual(["equal", "lower", "missing", "named", "null"]);
  });

  it("renormalizes weights around missing components and never fabricates a score", () => {
    const result = rankOccupations({ riasec: { a: 0, b: 1 }, jobZones: [2] }, [
      { code: "a", title: "A", riasec: { a: 0, b: 1 } },
      { code: "b", title: "B", riasec: { a: 1, b: 1 } },
      { code: "c", title: "C", jobZone: 2 },
    ]);
    expect(result.map((r) => r.score)).toEqual([1, null, null]);
    expect(result[2].components.riasec).toBeNull();
    expect(rankOccupations({}, [{ code: "d", title: "D" }])[0].score).toBeNull();
    expect(() => rankOccupations({ jobZones: [0] }, [])).toThrow();
    expect(() => rankOccupations({}, [], { riasec: -1 })).toThrow();
    expect(() => rankOccupations({ aspirations: [{ title: "A", rank: 0 }] }, [])).toThrow();
  });

  it("matches all aspiration keywords in any order and honors the best rank", () => {
    const aspirations = [{ title: "software developer", rank: 3 }, { title: "developer", rank: 2 }];
    expect(aspirationFit("Senior Developer, Software", aspirations)).toBe(0.5);
    expect(aspirationFit("Hardware Developer", [aspirations[0]])).toBe(0);
    expect(aspirationFit("Developer", [])).toBeNull();
    expect(() => aspirationFit("Developer", [{ title: "!!!", rank: 1 }])).toThrow();
  });
});

describe("skill priorities", () => {
  it("merges occupation demands and leaves unrated skills unknown", () => {
    const result = mergeSkillPriorities([
      { skillId: "a", name: "Analysis", importance: 1, weight: 3 },
      { skillId: "a", name: "Analysis", importance: 0.5, weight: 1 },
      { skillId: "b", name: "Writing", importance: 0.9 },
      { skillId: "c", name: "Ignored", importance: 1, weight: 0 },
    ], { a: 0.2 });
    expect(result).toHaveLength(2);
    expect(result[0].importance).toBe(3.5);
    expect(result[0].priority).toBeCloseTo(2.8);
    expect(result[1].rating).toBeNull();
    expect(result[1].priority).toBeNull();
    expect(mergeSkillPriorities([
      { skillId: "a", name: "Analysis", importance: 0.8, demand: 2, requiredLevel: 0.75 },
      { skillId: "a", name: "Analysis", importance: 0.5, requiredLevel: 0.5 },
    ], { a: 0.5 })[0]).toMatchObject({ importance: 2.1, priority: 0.4 });
    expect(() => mergeSkillPriorities([{ skillId: "a", name: "A", importance: 2 }], {})).toThrow();
  });
});
