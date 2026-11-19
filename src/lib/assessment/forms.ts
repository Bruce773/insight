import { createHash } from "node:crypto";
import type { AssessmentForm, AssessmentItem, AssessmentMode } from "@/lib/engine/assessment";

type StoredItem = {
  id: string;
  text: string;
  domain: string | null;
  facet: string | null;
  reverseKeyed: boolean | null;
};

const definitions = {
  quick: {
    instrument: "Mini-IPIP",
    count: 20,
    fingerprint: "1ddd8b0fbe6fd45fc39420b89e794c6e87c34ac5d59c82bf218c7b78b867e153",
    groups: ["Surgency or Extraversion", "Agreeableness", "Conscientiousness", "Neuroticism", "Intellect or Imagination"],
  },
  full: {
    instrument: "IPIP-NEO-120",
    count: 120,
    fingerprint: "93442fa9bb2d490cefc8a48abb0d7c1e56dd7991e1b71688855774dc2fd954c7",
    groups: ["N", "E", "O", "A", "C"].flatMap((domain) =>
      Array.from({ length: 6 }, (_, index) => `${domain}${index + 1}`)),
  },
} satisfies Record<AssessmentMode, { instrument: string; count: number; fingerprint: string; groups: string[] }>;

export function assessmentInstrument(mode: AssessmentMode): string {
  return definitions[mode].instrument;
}

export function createAssessmentForm(mode: AssessmentMode, stored: StoredItem[]): AssessmentForm | null {
  const definition = definitions[mode];
  if (stored.length !== definition.count || new Set(stored.map((item) => item.id)).size !== stored.length ||
      stored.some((item) => !item.id || !item.text || !item.domain || item.reverseKeyed === null)) {
    return null;
  }
  const canonical = stored.map((item) => [item.text, item.domain, item.facet, item.reverseKeyed]);
  canonical.sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
  const fingerprint = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  if (fingerprint !== definition.fingerprint) return null;

  const groups = definition.groups.map((group) => stored
    .filter((item) => mode === "quick" ? item.domain === group : item.facet?.startsWith(`${group}: `))
    .sort((a, b) => a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  if (groups.some((group) => group.length !== 4)) return null;
  const items: AssessmentItem[] = [];
  for (let index = 0; index < 4; index++) {
    for (const group of groups) {
      const item = group[index];
      if (!item.domain || item.reverseKeyed === null) return null;
      items.push({ id: item.id, text: item.text, domain: item.domain, facet: item.facet, reverseKeyed: item.reverseKeyed });
    }
  }
  return { mode, instrument: definition.instrument, items };
}
