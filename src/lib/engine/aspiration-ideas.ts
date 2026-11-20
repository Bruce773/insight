import type { AssessmentResult } from "./assessment";
import type { ScaleResult } from "./index";

export type IdeaSkill = { elementId: string; elementName: string };
export type IdeaTrait = { id: string; name: string; kind: "domain" | "facet"; result: ScaleResult };
export type AspirationIdea = { skill: IdeaSkill; trait: IdeaTrait | null };

export function ideaTraits(assessment?: AssessmentResult): IdeaTrait[] {
  if (!assessment) return [];
  return (["domains", "facets"] as const).flatMap((key) =>
    Object.entries(assessment[key]).map(([name, result], index) => ({
      id: `${key === "domains" ? "d" : "f"}${index}`,
      name, kind: key === "domains" ? "domain" as const : "facet" as const, result,
    })));
}

export function parseIdeaSkills(value: unknown): IdeaSkill[] {
  if (!value || typeof value !== "object" || !("items" in value) || !Array.isArray(value.items) ||
      !value.items.length) throw new Error("The imported skill catalog is empty or invalid.");
  const skills: IdeaSkill[] = [];
  const seen = new Set<string>();
  for (const item of value.items) {
    if (!item || typeof item !== "object" || typeof item.elementId !== "string" ||
        !/^2\.[AB]\./.test(item.elementId) || typeof item.elementName !== "string" ||
        !item.elementName.trim() || seen.has(item.elementId)) {
      throw new Error("The imported skill catalog is invalid or contains conflicting skill IDs.");
    }
    seen.add(item.elementId);
    skills.push({ elementId: item.elementId, elementName: item.elementName });
  }
  return skills;
}

export function parseAspirationIdeas(text: string, skills: IdeaSkill[], traits: IdeaTrait[]): AspirationIdea[] {
  let value: unknown;
  try {
    // WebLLM may prepend an empty Qwen thinking block even with thinking disabled.
    value = JSON.parse(text.replace(/^\s*<think>\s*<\/think>\s*/, ""));
  } catch {
    throw new Error("The local model returned invalid JSON. Please try again.");
  }
  if (!value || typeof value !== "object" || !("ideas" in value) || !Array.isArray(value.ideas) ||
      value.ideas.length < 1 || value.ideas.length > 5) {
    throw new Error("The local model returned an invalid suggestion list. Please try again.");
  }
  const seen = new Set<string>();
  return value.ideas.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("skillId" in item) || !("traitId" in item) ||
        typeof item.skillId !== "string" || typeof item.traitId !== "string") {
      throw new Error("The local model returned an invalid suggestion. Please try again.");
    }
    const skill = skills.find((candidate) => candidate.elementId === item.skillId);
    const trait = traits.find((candidate) => candidate.id === item.traitId);
    if (!skill || seen.has(skill.elementId) || (traits.length ? !trait : item.traitId !== "")) {
      throw new Error("The local model referred to an unknown or duplicate skill or score. Please try again.");
    }
    seen.add(skill.elementId);
    return { skill, trait: trait ?? null };
  });
}
