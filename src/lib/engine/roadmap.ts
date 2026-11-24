export type DurationUnit = "weeks" | "months" | "years";
export type Duration = { amount: number; unit: DurationUnit };
export type RoadmapSkill = { id: string; name: string; source: "user" | "ai"; review?: boolean };
export type RoadmapStep = { id: string; text: string; at: number; notes?: string; source: "user" | "ai"; review?: boolean };
export type Roadmap = { skills: RoadmapSkill[]; steps: RoadmapStep[] };
export type StepSuggestion = { text: string; at: number };

export function isDuration(value: unknown): value is Duration {
  if (!value || typeof value !== "object" || !("amount" in value) || !("unit" in value)) return false;
  return typeof value.amount === "number" && Number.isInteger(value.amount) && value.amount > 0 &&
    value.amount <= 1000 && (value.unit === "weeks" || value.unit === "months" || value.unit === "years");
}

export function isRoadmap(value: unknown): value is Roadmap {
  if (!value || typeof value !== "object" || !("skills" in value) || !("steps" in value) ||
      !Array.isArray(value.skills) || !Array.isArray(value.steps) ||
      value.skills.length > 100 || value.steps.length > 100) return false;
  const ids = new Set<string>();
  const validItem = (item: unknown): item is Record<string, unknown> => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id || ids.has(record.id) ||
        (record.source !== "user" && record.source !== "ai") ||
        (record.review !== undefined && typeof record.review !== "boolean")) return false;
    ids.add(record.id);
    return true;
  };
  return value.skills.every((item: unknown) => validItem(item) && typeof item.name === "string" && item.name.length <= 200 && !!item.name.trim()) &&
    value.steps.every((item: unknown) => validItem(item) && typeof item.text === "string" && item.text.length <= 500 &&
      (item.notes === undefined || typeof item.notes === "string" && item.notes.length <= 4000) &&
      typeof item.at === "number" && Number.isInteger(item.at) && item.at >= 1 && item.at <= 1000);
}

export function parseStepSuggestions(text: string, duration: Duration): StepSuggestion[] {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\s*<think>\s*<\/think>\s*/, ""));
  } catch {
    throw new Error("The local model returned invalid JSON. Please try again.");
  }
  if (!value || typeof value !== "object" || !("steps" in value) || !Array.isArray(value.steps) ||
      value.steps.length < 1 || value.steps.length > 8) {
    throw new Error("The local model returned an invalid roadmap. Please try again.");
  }
  return value.steps.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("text" in item) || !("at" in item) ||
        typeof item.text !== "string" || !item.text.trim() || item.text.length > 500 ||
        typeof item.at !== "number" || !Number.isInteger(item.at) || item.at < 1 || item.at > duration.amount) {
      throw new Error("The local model returned an invalid roadmap step. Please try again.");
    }
    return { text: item.text.trim(), at: item.at };
  });
}

export function markRoadmapForReview(roadmap?: Roadmap): Roadmap | undefined {
  if (!roadmap) return undefined;
  return {
    skills: roadmap.skills.map((skill) => ({ ...skill, review: true })),
    steps: roadmap.steps.map((step) => ({ ...step, review: true })),
  };
}
