/**
 * Pure scoring utilities. Scores and occupation vectors use the 0–1 scale
 * unless explicitly stated otherwise. Callers must supply compatible,
 * appropriately licensed assessment items and occupation data.
 */
export type Scores = Record<string, number>;
export type Responses = Record<string, number | undefined>;

export interface PersonalityItem {
  id: string;
  facet: string;
  domain: string;
  reverseKeyed?: boolean;
  min?: number;
  max?: number;
}

export interface Norm {
  /** Mean and standard deviation of the raw summed scale score. */
  mean: number;
  standardDeviation: number;
  /** When supplied, norms are applied only for scales with this many answers. */
  count?: number;
}

export interface ScaleResult {
  /** Sum of reverse-keyed responses in their original units. */
  rawScore: number;
  /** Mean of item scores normalized to 0–1. */
  score: number;
  count: number;
  /** Normal-distribution estimates, present only when an applicable norm is supplied. */
  zScore?: number;
  percentile?: number;
}

export interface PersonalityResult {
  facets: Record<string, ScaleResult>;
  domains: Record<string, ScaleResult>;
}

export const RIASEC_DIMENSIONS = [
  "realistic", "investigative", "artistic", "social", "enterprising", "conventional",
] as const;
export type RiasecDimension = typeof RIASEC_DIMENSIONS[number];
export interface RiasecItem {
  id: string;
  dimension: RiasecDimension;
  reverseKeyed?: boolean;
  min?: number;
  max?: number;
}
export type RiasecResult = Partial<Record<RiasecDimension, ScaleResult>>;

function normalizedResponse(
  item: { id: string; min?: number; max?: number; reverseKeyed?: boolean },
  responses: Responses,
): { score: number; rawScore: number } | undefined {
  const min = item.min ?? 1;
  const max = item.max ?? 5;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw new RangeError(`Invalid response range for item ${item.id}`);
  }
  const value = Object.prototype.hasOwnProperty.call(responses, item.id) ? responses[item.id] : undefined;
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Response out of range for item ${item.id}`);
  }
  const score = (value - min) / (max - min);
  return {
    score: item.reverseKeyed ? 1 - score : score,
    rawScore: item.reverseKeyed ? min + max - value : value,
  };
}

type Answer = { score: number; rawScore: number };

// Standard normal CDF approximation; meaningful only if the caller's norms
// reasonably follow a normal distribution.
function normalPercentile(z: number): number {
  const x = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * x);
  const density = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const tail = density * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 100 * (z >= 0 ? 1 - tail : tail);
}

function summarize(
  groups: Record<string, Answer[]>,
  norms?: Record<string, Norm>,
): Record<string, ScaleResult> {
  const result: Record<string, ScaleResult> = Object.create(null);
  for (const [key, values] of Object.entries(groups)) {
    const score = values.reduce((sum, value) => sum + value.score, 0) / values.length;
    const rawScore = values.reduce((sum, value) => sum + value.rawScore, 0);
    const norm = norms && Object.prototype.hasOwnProperty.call(norms, key) ? norms[key] : undefined;
    if (norm && (!Number.isFinite(norm.mean) ||
      !Number.isFinite(norm.standardDeviation) || norm.standardDeviation <= 0 ||
      (norm.count !== undefined && (!Number.isInteger(norm.count) || norm.count < 1)))) {
      throw new RangeError(`Invalid norm for ${key}`);
    }
    result[key] = { rawScore, score, count: values.length };
    if (norm && (norm.count === undefined || norm.count === values.length)) {
      const zScore = (rawScore - norm.mean) / norm.standardDeviation;
      result[key].zScore = zScore;
      result[key].percentile = normalPercentile(zScore);
    }
  }
  return result;
}

function add(groups: Record<string, Answer[]>, key: string, value: Answer): void {
  (groups[key] ??= []).push(value);
}

function checkId(id: string, seen: Set<string>): void {
  if (!id || seen.has(id)) throw new Error(`Missing or duplicate item id: ${id}`);
  seen.add(id);
}

/**
 * Averages answered items within each facet and domain. Missing responses
 * produce no result, not a zero. Norms are optional and never inferred;
 * callers must ensure their norms apply to the answered items and population.
 */
export function scorePersonality(
  items: readonly PersonalityItem[],
  responses: Responses,
  norms?: { facets?: Record<string, Norm>; domains?: Record<string, Norm> },
): PersonalityResult {
  const facets: Record<string, Answer[]> = Object.create(null);
  const domains: Record<string, Answer[]> = Object.create(null);
  const seen = new Set<string>();
  for (const item of items) {
    checkId(item.id, seen);
    if (!item.facet || !item.domain) throw new Error(`Missing facet or domain for ${item.id}`);
    const score = normalizedResponse(item, responses);
    if (score !== undefined) {
      add(facets, item.facet, score);
      add(domains, item.domain, score);
    }
  }
  return { facets: summarize(facets, norms?.facets), domains: summarize(domains, norms?.domains) };
}

/** Returns only dimensions with answered items, using the same normalized scale. */
export function scoreRiasec(items: readonly RiasecItem[], responses: Responses): RiasecResult {
  const groups: Record<string, Answer[]> = Object.create(null);
  const seen = new Set<string>();
  for (const item of items) {
    checkId(item.id, seen);
    if (!RIASEC_DIMENSIONS.includes(item.dimension)) throw new Error(`Invalid RIASEC dimension: ${item.dimension}`);
    const score = normalizedResponse(item, responses);
    if (score !== undefined) add(groups, item.dimension, score);
  }
  return summarize(groups) as RiasecResult;
}

/** Pairwise Pearson correlation; null for fewer than two pairs or zero variance. */
export function pearsonCorrelation(a: readonly number[], b: readonly number[]): number | null {
  if (a.length !== b.length) throw new RangeError("Vectors must have equal length");
  if (a.length < 2 || a.some((x) => !Number.isFinite(x)) || b.some((x) => !Number.isFinite(x))) return null;
  const meanA = a.reduce((sum, x) => sum + x, 0) / a.length;
  const meanB = b.reduce((sum, x) => sum + x, 0) / b.length;
  let covariance = 0, varianceA = 0, varianceB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - meanA, y = b[i] - meanB;
    covariance += x * y;
    varianceA += x * x;
    varianceB += y * y;
  }
  if (varianceA === 0 || varianceB === 0) return null;
  return Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceA * varianceB)));
}

/** A negative weight reverses a facet; magnitude controls its contribution. */
export type FacetWorkStyleMapping = Record<string, Record<string, number>>;

/**
 * Maps facet scores to work styles using caller-supplied weights. The bundled
 * mapping is illustrative, not validated or suitable for diagnostic use.
 */
export function mapFacetsToWorkStyles(facets: Scores, mapping: FacetWorkStyleMapping): Scores {
  const result: Scores = Object.create(null);
  for (const [style, weights] of Object.entries(mapping)) {
    let total = 0, sum = 0;
    for (const [facet, weight] of Object.entries(weights)) {
      if (!Number.isFinite(weight)) throw new RangeError(`Invalid mapping weight for ${facet}`);
      const score = Object.prototype.hasOwnProperty.call(facets, facet) ? facets[facet] : undefined;
      if (score === undefined || weight === 0) continue;
      assertUnit(score, `facet ${facet}`);
      const magnitude = Math.abs(weight);
      total += magnitude;
      sum += magnitude * (weight < 0 ? 1 - score : score);
    }
    if (total > 0) result[style] = sum / total;
  }
  return result;
}

function assertUnit(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${label} must be between 0 and 1`);
}

/** Rank 1 means the user's highest aspiration. Title words are searched case-insensitively. */
export interface Aspiration {
  title: string;
  rank: number;
}
export interface MatchProfile {
  riasec?: Scores;
  workStyles?: Scores;
  aspirations?: readonly Aspiration[];
  jobZones?: readonly number[];
}
export interface Occupation {
  code: string;
  title: string;
  jobZone?: number | null;
  riasec?: Scores;
  workStyles?: Scores;
}
export interface MatchWeights {
  riasec: number;
  workStyles: number;
  aspirations: number;
}
export interface OccupationMatch<T extends Occupation = Occupation> {
  occupation: T;
  /** Null means no comparable evidence, not a zero match. */
  score: number | null;
  components: Record<keyof MatchWeights, number | null>;
}

/** Pearson correlation on shared dimensions, rescaled from [-1, 1] to [0, 1]. */
export function interestFit(a?: Scores, b?: Scores): number | null {
  if (!a || !b) return null;
  const keys = Object.keys(a).filter((key) => Object.prototype.hasOwnProperty.call(b, key));
  for (const key of keys) {
    assertUnit(a[key], key);
    assertUnit(b[key], key);
  }
  const correlation = pearsonCorrelation(keys.map((key) => a[key]), keys.map((key) => b[key]));
  return correlation === null ? null : (correlation + 1) / 2;
}

const titleKeywords = (title: string): string[] => title.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const validZone = (zone: number): boolean => Number.isInteger(zone) && zone >= 1 && zone <= 5;

/**
 * Search for all words of an aspiration in an occupation title, in any order.
 * The highest matching rank contributes 1/rank. Null means no aspirations.
 */
export function aspirationFit(title: string, aspirations: readonly Aspiration[]): number | null {
  if (!aspirations.length) return null;
  const words = new Set(titleKeywords(title));
  let best = 0;
  for (const aspiration of aspirations) {
    const keywords = titleKeywords(aspiration.title);
    if (!keywords.length || !Number.isInteger(aspiration.rank) || aspiration.rank < 1) {
      throw new RangeError("Aspirations require keywords and a positive integer rank");
    }
    if (keywords.every((keyword) => words.has(keyword))) best = Math.max(best, 1 / aspiration.rank);
  }
  return best;
}

/**
 * Weighted mean of available components only; missing/constant vectors are
 * excluded. Job Zones filter occupations outside the selected horizon, except
 * for occupations explicitly named in the user's aspirations.
 * The default equal weights are configurable and are not empirically calibrated.
 */
export function rankOccupations<T extends Occupation>(
  profile: MatchProfile,
  occupations: readonly T[],
  weights: Partial<MatchWeights> = {},
): OccupationMatch<T>[] {
  const resolved: MatchWeights = { riasec: 1, workStyles: 1, aspirations: 1, ...weights };
  for (const [name, weight] of Object.entries(resolved)) {
    if (!Number.isFinite(weight) || weight < 0) throw new RangeError(`Invalid weight: ${name}`);
  }
  const aspirations = profile.aspirations ?? [];
  for (const aspiration of aspirations) {
    if (!titleKeywords(aspiration.title).length || !Number.isInteger(aspiration.rank) || aspiration.rank < 1) {
      throw new RangeError("Aspirations require a title and a positive integer rank");
    }
  }
  if (profile.jobZones?.some((zone) => !validZone(zone))) throw new RangeError("Job zones must be integers from 1 to 5");
  return occupations.filter((occupation) => {
    if (occupation.jobZone != null && !validZone(occupation.jobZone)) throw new RangeError(`Invalid job zone for ${occupation.code}`);
    const aspiration = aspirationFit(occupation.title, aspirations);
    const explicitlyNamed = aspiration !== null && aspiration > 0;
    return !profile.jobZones?.length || occupation.jobZone == null ||
      profile.jobZones.some((zone) => occupation.jobZone <= zone) || explicitlyNamed;
  }).map((occupation): OccupationMatch<T> => {
    const components: OccupationMatch["components"] = {
      riasec: interestFit(profile.riasec, occupation.riasec),
      workStyles: interestFit(profile.workStyles, occupation.workStyles),
      aspirations: aspirationFit(occupation.title, aspirations),
    };
    let sum = 0, total = 0;
    for (const key of Object.keys(resolved) as (keyof MatchWeights)[]) {
      const value = components[key];
      if (value !== null && resolved[key] > 0) {
        sum += value * resolved[key];
        total += resolved[key];
      }
    }
    return { occupation, score: total ? sum / total : null, components };
  }).sort((a, b) => {
    if (a.score === null && b.score !== null) return 1;
    if (a.score !== null && b.score === null) return -1;
    return (b.score ?? 0) - (a.score ?? 0) ||
      a.occupation.title.localeCompare(b.occupation.title) || a.occupation.code.localeCompare(b.occupation.code);
  });
}

export interface SkillDemand {
  skillId: string;
  name: string;
  /** Normalized importance for an occupation. */
  importance: number;
  /** External demand multiplier for the skill and occupation. Defaults to 1. */
  demand?: number;
  /** Required skill level on the 0–1 scale. Defaults to 1. */
  requiredLevel?: number;
  /** Optional occupation relevance, e.g. its match score. Defaults to 1. */
  weight?: number;
}
export interface SkillPriority {
  skillId: string;
  name: string;
  /** Sum of demand-weighted importance across occupations. */
  importance: number;
  rating: number | null;
  /** Sum of per-occupation importance × demand × skill-level gap; null if unrated. */
  priority: number | null;
}

/** Sums repeated skill contributions; unknown ratings remain unknown. */
export function mergeSkillPriorities(
  demands: readonly SkillDemand[],
  selfRatings: Responses,
): SkillPriority[] {
  const groups = new Map<string, { name: string; importance: number; priority: number; weight: number }>();
  for (const demand of demands) {
    if (!demand.skillId || !demand.name) throw new Error("Skills require an id and name");
    assertUnit(demand.importance, `importance for ${demand.skillId}`);
    const demandWeight = demand.demand ?? 1;
    if (!Number.isFinite(demandWeight) || demandWeight < 0) throw new RangeError(`Invalid demand for ${demand.skillId}`);
    const requiredLevel = demand.requiredLevel ?? 1;
    assertUnit(requiredLevel, `required level for ${demand.skillId}`);
    const weight = demand.weight ?? 1;
    if (!Number.isFinite(weight) || weight < 0) throw new RangeError(`Invalid weight for ${demand.skillId}`);
    const current = groups.get(demand.skillId) ?? { name: demand.name, importance: 0, priority: 0, weight: 0 };
    if (current.name !== demand.name) throw new Error(`Conflicting names for skill ${demand.skillId}`);
    const contribution = demand.importance * demandWeight * weight;
    current.importance += contribution;
    const rating = Object.prototype.hasOwnProperty.call(selfRatings, demand.skillId) ? selfRatings[demand.skillId] ?? null : null;
    if (rating !== null) {
      assertUnit(rating, `rating for ${demand.skillId}`);
      current.priority += contribution * Math.max(0, requiredLevel - rating);
    }
    current.weight += weight;
    groups.set(demand.skillId, current);
  }
  return [...groups.entries()].filter(([, group]) => group.weight > 0).map(([skillId, group]) => {
    const rating = Object.prototype.hasOwnProperty.call(selfRatings, skillId) ? selfRatings[skillId] ?? null : null;
    if (rating !== null) assertUnit(rating, `rating for ${skillId}`);
    return { skillId, name: group.name, importance: group.importance, rating, priority: rating === null ? null : group.priority };
  }).sort((a, b) => {
    if (a.priority === null && b.priority !== null) return 1;
    if (a.priority !== null && b.priority === null) return -1;
    return (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name) || a.skillId.localeCompare(b.skillId);
  });
}
