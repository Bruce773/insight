import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { db, client } from "../src/lib/db/index";
import { assessmentItems, occupationDemand, occupationRatings, occupations, occInterests, occRequirements, occWorkStyles } from "../src/lib/db/schema";
import { mapRows, type SourceConfig } from "../src/lib/db/tabular";

type ImportConfig = {
  occupations?: SourceConfig;
  jobZones?: SourceConfig;
  ratings?: SourceConfig[];
  interests?: RatingSource[];
  workStyles?: RatingSource[];
  requirements?: RatingSource[];
  items?: SourceConfig[];
  demand?: SourceConfig[];
};
type RatingSource = SourceConfig & { scales?: Record<string, { min: number; max: number }> };
type Mode = "all" | "onet" | "items" | "demand";

function number(value: string | undefined, field: string, integer = false): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) throw new Error(`Invalid ${field}: ${value}`);
  return parsed;
}

function bool(value: string | undefined): boolean | null {
  if (!value) return null;
  if (value === "+") return false;
  if (value === "-") return true;
  if (/^(true|yes|1)$/i.test(value)) return true;
  if (/^(false|no|0)$/i.test(value)) return false;
  throw new Error(`Invalid reverseKeyed: ${value}`);
}

function requireNumber(value: string | undefined, field: string): number {
  const result = number(value, field);
  if (result === undefined) throw new Error(`${field} is required`);
  return result;
}

async function load(base: string, source: SourceConfig, defaults: Record<string, string | string[]>, required: string[]) {
  if (!source || typeof source.file !== "string") throw new Error("Each source must specify a file");
  const content = await readFile(resolve(base, source.file), "utf8");
  return mapRows(content, source, defaults, required);
}

function unique<T>(values: T[], key: (value: T) => string, name: string) {
  const seen = new Set<string>();
  for (const value of values) {
    const k = key(value);
    if (seen.has(k)) throw new Error(`Duplicate ${name} key: ${k}`);
    seen.add(k);
  }
}

function chunks<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += 500) result.push(values.slice(i, i + 500));
  return result;
}

async function main(mode: Mode) {
  const configPath = process.argv[2];
  if (!configPath) throw new Error("Usage: tsx scripts/import-data.ts <config.json>");
  const path = resolve(configPath);
  const config = JSON.parse(await readFile(path, "utf8")) as ImportConfig;
  if (mode === "onet") { delete config.items; delete config.demand; }
  if (mode === "items") { delete config.occupations; delete config.jobZones; delete config.ratings; delete config.interests; delete config.workStyles; delete config.requirements; delete config.demand; }
  if (mode === "demand") { delete config.occupations; delete config.jobZones; delete config.ratings; delete config.interests; delete config.workStyles; delete config.requirements; delete config.items; }
  if (!config.occupations && !config.jobZones && !config.ratings?.length && !config.interests?.length && !config.workStyles?.length && !config.requirements?.length && !config.items?.length && !config.demand?.length) {
    throw new Error("No import sources configured");
  }
  const base = dirname(path);
  const occ = config.occupations ? (await load(base, config.occupations, {
    code: "O*NET-SOC Code", title: "Title", description: "Description", jobZone: "Job Zone",
  }, ["code", "title"])).map((r) => {
    const jobZone = number(r.jobZone, "jobZone", true);
    if (jobZone !== undefined && (jobZone < 1 || jobZone > 5)) throw new Error(`Invalid jobZone: ${jobZone}`);
    return { code: r.code, title: r.title, description: r.description || null, jobZone: jobZone ?? null };
  }) : [];
  const jobZones = config.jobZones ? (await load(base, config.jobZones, {
    code: "O*NET-SOC Code", jobZone: "Job Zone",
  }, ["code", "jobZone"])).map((r) => {
    const jobZone = number(r.jobZone, "jobZone", true);
    if (jobZone === undefined || jobZone < 1 || jobZone > 5) throw new Error(`Invalid jobZone: ${r.jobZone}`);
    return { code: r.code, jobZone };
  }) : [];
  const loadRatings = async (sources: RatingSource[]) => (await Promise.all(sources.map(async (s) => (await load(base, s, {
    occupationCode: "O*NET-SOC Code", elementId: "Element ID", elementName: "Element Name",
    scaleId: "Scale ID", value: "Data Value", source: "Source",
  }, ["occupationCode", "elementId", "elementName", "scaleId", "value", "source"])).map((r) => {
    const rawValue = requireNumber(r.value, "rating value");
    const scale = s.scales?.[r.scaleId];
    if (scale && (!Number.isFinite(scale.min) || !Number.isFinite(scale.max) || scale.max <= scale.min || rawValue < scale.min || rawValue > scale.max)) {
      throw new Error(`Invalid scale or out-of-range rating for ${r.scaleId}: ${rawValue}`);
    }
    return { occupationCode: r.occupationCode, elementId: r.elementId, elementName: r.elementName,
      scaleId: r.scaleId, rawValue, value: scale ? (rawValue - scale.min) / (scale.max - scale.min) : null, source: r.source };
  })))).flat();
  const generic = await loadRatings(config.ratings ?? []);
  const interests = await loadRatings(config.interests ?? []);
  const workStyles = await loadRatings(config.workStyles ?? []);
  const requirements = await loadRatings(config.requirements ?? []);
  const ratings = [...generic, ...interests, ...workStyles, ...requirements];
  const items = (await Promise.all((config.items ?? []).map((s) => load(base, s, {
    id: ["id", "Item ID"], instrument: "Instrument", text: ["text", "Item Text"], domain: "Domain",
    facet: "Facet", reverseKeyed: ["keyed", "Reverse Keyed"], responseMin: "Response Min", responseMax: "Response Max", source: "Source",
  }, ["id", "instrument", "text", "source"])))).flat().map((r) => {
    const responseMin = number(r.responseMin, "responseMin");
    const responseMax = number(r.responseMax, "responseMax");
    if ((responseMin === undefined) !== (responseMax === undefined) || (responseMin !== undefined && responseMax !== undefined && responseMin >= responseMax)) throw new Error(`Invalid response range for ${r.id}`);
    return { id: r.id, instrument: r.instrument, text: r.text, domain: r.domain || null, facet: r.facet || null,
      reverseKeyed: bool(r.reverseKeyed), responseMin: responseMin ?? null, responseMax: responseMax ?? null, source: r.source };
  });
  const demand = (await Promise.all((config.demand ?? []).map((s) => load(base, s, {
    occupationCode: "O*NET-SOC Code", metric: "Metric", value: "Value", unit: "Unit", year: "Year", source: "Source",
  }, ["occupationCode", "metric", "value", "source"])))).flat().map((r) => ({
    occupationCode: r.occupationCode, metric: r.metric, value: requireNumber(r.value, "demand value"),
    unit: r.unit || "", year: number(r.year, "year", true) ?? 0, source: r.source,
  }));
  unique(occ, (r) => JSON.stringify([r.code]), "occupation");
  unique(jobZones, (r) => JSON.stringify([r.code]), "job zone");
  unique(ratings, (r) => JSON.stringify([r.occupationCode, r.elementId, r.scaleId]), "rating");
  unique(items, (r) => JSON.stringify([r.id]), "item");
  unique(demand, (r) => JSON.stringify([r.occupationCode, r.metric, r.unit, r.year, r.source]), "demand");
  await db.transaction(async (tx) => {
    for (const batch of chunks(occ)) await tx.insert(occupations).values(batch).onConflictDoUpdate({
      target: occupations.code, set: { title: sql`excluded.title`, description: sql`excluded.description`, jobZone: sql`coalesce(excluded.job_zone, ${occupations.jobZone})` },
    });
    for (const r of jobZones) {
      const updated = await tx.update(occupations).set({ jobZone: r.jobZone }).where(eq(occupations.code, r.code)).returning({ code: occupations.code });
      if (!updated.length) throw new Error(`Job zone references unknown occupation ${r.code}`);
    }
    for (const batch of chunks(ratings.map((r) => ({ ...r, value: r.rawValue })))) await tx.insert(occupationRatings).values(batch).onConflictDoUpdate({
      target: [occupationRatings.occupationCode, occupationRatings.elementId, occupationRatings.scaleId],
      set: { elementName: sql`excluded.element_name`, value: sql`excluded.value`, source: sql`excluded.source` },
    });
    for (const batch of chunks(interests)) await tx.insert(occInterests).values(batch).onConflictDoUpdate({
      target: [occInterests.occupationCode, occInterests.elementId, occInterests.scaleId],
      set: { elementName: sql`excluded.element_name`, rawValue: sql`excluded.raw_value`, value: sql`excluded.value`, source: sql`excluded.source` },
    });
    for (const batch of chunks(workStyles)) await tx.insert(occWorkStyles).values(batch).onConflictDoUpdate({
      target: [occWorkStyles.occupationCode, occWorkStyles.elementId, occWorkStyles.scaleId],
      set: { elementName: sql`excluded.element_name`, rawValue: sql`excluded.raw_value`, value: sql`excluded.value`, source: sql`excluded.source` },
    });
    for (const batch of chunks(requirements)) await tx.insert(occRequirements).values(batch).onConflictDoUpdate({
      target: [occRequirements.occupationCode, occRequirements.elementId, occRequirements.scaleId],
      set: { elementName: sql`excluded.element_name`, rawValue: sql`excluded.raw_value`, value: sql`excluded.value`, source: sql`excluded.source` },
    });
    for (const batch of chunks(items)) await tx.insert(assessmentItems).values(batch).onConflictDoUpdate({
      target: assessmentItems.id, set: { instrument: sql`excluded.instrument`, text: sql`excluded.text`, domain: sql`excluded.domain`, facet: sql`excluded.facet`, reverseKeyed: sql`excluded.reverse_keyed`, responseMin: sql`excluded.response_min`, responseMax: sql`excluded.response_max`, source: sql`excluded.source` },
    });
    for (const batch of chunks(demand)) await tx.insert(occupationDemand).values(batch).onConflictDoUpdate({
      target: [occupationDemand.occupationCode, occupationDemand.metric, occupationDemand.unit, occupationDemand.year, occupationDemand.source],
      set: { value: sql`excluded.value` },
    });
  });
  console.log(`Imported ${occ.length} occupations, ${jobZones.length} job zones, ${ratings.length} ratings, ${items.length} items, ${demand.length} demand records.`);
}

export function runImport(mode: Mode) {
  return main(mode).catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => client.end());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runImport("all");
