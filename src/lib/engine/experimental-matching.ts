import mapping from "../../../data/mappings/facet-to-workstyle.json";
import { mapFacetsToWorkStyles, rankOccupations, type OccupationMatch } from "./index";
import type { AssessmentResult } from "./assessment";

export const experimentalWorkStyles = Object.keys(mapping.mapping);

export type WorkStyleRow = {
  code: string;
  title: string;
  description: string | null;
  jobZone: number | null;
  elementName: string;
  value: number | null;
};

type WorkStyleOccupation = {
  code: string;
  title: string;
  description: string | null;
  jobZone: number | null;
  workStyles: Record<string, number>;
};

export function experimentalMatches(result: AssessmentResult, rows: readonly WorkStyleRow[]): OccupationMatch<WorkStyleOccupation>[] {
  if (result.instrument !== "IPIP-NEO-120") {
    throw new Error("The full assessment is required for experimental matching.");
  }
  const facets: Record<string, number> = Object.create(null);
  for (const [label, score] of Object.entries(result.facets)) {
    const name = label.replace(/^[A-Z]\d: /, "").toLowerCase().replace(/[\s-]+/g, "_");
    if (score.count !== 4 || Object.hasOwn(facets, name)) {
      throw new Error("The full assessment facet scores are incomplete or invalid.");
    }
    facets[name] = score.score;
  }
  const profile = mapFacetsToWorkStyles(facets, mapping.mapping);
  if (experimentalWorkStyles.some((name) => profile[name] === undefined) ||
      Object.values(mapping.mapping).some((weights) =>
        Object.keys(weights).some((name) => facets[name] === undefined))) {
    throw new Error("The full assessment facet scores are incomplete or invalid.");
  }

  const occupations = new Map<string, WorkStyleOccupation>();
  const invalid = new Set<string>();
  for (const row of rows) {
    if (!experimentalWorkStyles.includes(row.elementName)) continue;
    const occupation = occupations.get(row.code) ?? {
      code: row.code, title: row.title, description: row.description, jobZone: row.jobZone,
      workStyles: Object.create(null),
    };
    if (row.value === null || !Number.isFinite(row.value) || row.value < 0 || row.value > 1 ||
        Object.hasOwn(occupation.workStyles, row.elementName)) {
      invalid.add(row.code);
    } else {
      occupation.workStyles[row.elementName] = row.value;
    }
    occupations.set(row.code, occupation);
  }
  const complete = [...occupations.values()].filter((occupation) =>
    !invalid.has(occupation.code) && experimentalWorkStyles.every((name) => Object.hasOwn(occupation.workStyles, name)));
  return rankOccupations({ workStyles: profile }, complete, { riasec: 0, aspirations: 0 })
    .filter((match) => match.score !== null);
}
