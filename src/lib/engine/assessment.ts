import { scorePersonality, type PersonalityResult, type Responses } from "./index";

export type AssessmentMode = "quick" | "full";

export interface AssessmentItem {
  id: string;
  text: string;
  domain: string;
  facet: string | null;
  reverseKeyed: boolean;
}

export interface AssessmentForm {
  mode: AssessmentMode;
  instrument: string;
  items: AssessmentItem[];
}

export interface AssessmentResult extends PersonalityResult {
  instrument: string;
  responses: Record<string, number>;
}

export const ASSESSMENT_OPTIONS = [
  { value: 1, label: "Very inaccurate" },
  { value: 2, label: "Moderately inaccurate" },
  { value: 3, label: "Neither inaccurate nor accurate" },
  { value: 4, label: "Moderately accurate" },
  { value: 5, label: "Very accurate" },
] as const;

export function scoreAssessment(form: AssessmentForm, responses: Responses): AssessmentResult {
  const ids = new Set(form.items.map((item) => item.id));
  if (!form.items.length || ids.size !== form.items.length ||
      Object.keys(responses).length !== ids.size ||
      Object.keys(responses).some((id) => !ids.has(id))) {
    throw new Error("The assessment must contain exactly one response for each question.");
  }
  const complete: Record<string, number> = Object.create(null);
  for (const item of form.items) {
    const value = responses[item.id];
    if (value === undefined || !Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error("Answer every question using the provided response options.");
    }
    complete[item.id] = value;
  }
  const scores = scorePersonality(form.items.map((item) => ({ ...item, min: 1, max: 5 })), complete);
  return { instrument: form.instrument, responses: complete, ...scores };
}
