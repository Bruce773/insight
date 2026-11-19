/** O*NET Web Services v2: https://services.onetcenter.org/reference/index */
const BASE_URL = "https://api-v2.onetcenter.org";
const SOC_CODE = /^\d{2}-\d{4}\.\d{2}$/;

export interface OnetOccupation {
  code: string;
  title: string;
}

export interface OnetPage<T> {
  start: number;
  end: number;
  total: number;
  next?: string;
  occupation?: T[];
  element?: T[];
}

export interface OnetOccupationReport {
  occupation: OnetOccupation;
  description: string;
  sample_of_reported_titles?: string[];
}

export interface OnetSkill {
  id: string;
  name: string;
  description: string;
}

export interface InterestProfilerQuestion {
  index: number;
  area: string;
  text: string;
}

export interface InterestProfilerQuestions {
  start: number;
  end: number;
  total: number;
  next?: string;
  answer_option: { value: number; name: string }[];
  question: InterestProfilerQuestion[];
}

export interface InterestProfilerResults {
  careers: string;
  result: { code: string; description: string; score: number }[];
}

export interface OnetOptions {
  /** Defaults to ONET_API_KEY; never put this value in client-side code. */
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}

export interface OnetPagination {
  /** O*NET uses one-based inclusive indices. */
  start?: number;
  end?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isOccupation(value: unknown): value is OnetOccupation {
  return isRecord(value) && typeof value.code === "string" && typeof value.title === "string";
}

function isSkill(value: unknown): value is OnetSkill {
  return isRecord(value) && typeof value.id === "string" &&
    typeof value.name === "string" && typeof value.description === "string";
}

function validatePage<T>(
  value: unknown,
  field: "occupation" | "element",
  isItem: (item: unknown) => item is T,
): OnetPage<T> {
  if (!isRecord(value) ||
      !Number.isInteger(value.start) || !Number.isInteger(value.end) ||
      !Number.isInteger(value.total) || !Array.isArray(value[field]) ||
      !value[field].every(isItem) ||
      (value.next !== undefined && typeof value.next !== "string")) {
    throw new Error("Invalid O*NET page response");
  }
  return value as unknown as OnetPage<T>;
}

function addPagination(url: URL, page: OnetPagination): void {
  const { start, end } = page;
  if ((start !== undefined && (!Number.isSafeInteger(start) || start < 1)) ||
      (end !== undefined && (!Number.isSafeInteger(end) || end < 1)) ||
      (end !== undefined && end < (start ?? 1))) {
    throw new RangeError("O*NET pagination requires positive, ordered integer indices");
  }
  if (start !== undefined) url.searchParams.set("start", String(start));
  if (end !== undefined) url.searchParams.set("end", String(end));
}

function validateCode(code: string): void {
  if (!SOC_CODE.test(code)) throw new TypeError("Invalid O*NET-SOC code");
}

/**
 * Server-side client. Credentials are checked before every request. Pagination
 * links are informational only: construct requests using start/end instead of
 * fetching an untrusted URL with credentials.
 */
export function createOnetClient(options: OnetOptions = {}) {
  async function get(path: string, query?: (url: URL) => void): Promise<unknown> {
    if (typeof window !== "undefined") throw new Error("O*NET client is server-side only");
    const key = options.apiKey ?? process.env.ONET_API_KEY;
    if (!key?.trim()) throw new Error("ONET_API_KEY is required");
    const url = new URL(path, BASE_URL);
    query?.(url);
    const response = await (options.fetch ?? globalThis.fetch)(url, {
      method: "GET",
      headers: { "X-API-Key": key, Accept: "application/json" },
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`O*NET request failed (HTTP ${response.status})`);
    return response.json();
  }

  return {
    async searchOccupations(keyword: string, page: OnetPagination = {}): Promise<OnetPage<OnetOccupation>> {
      if (!keyword.trim()) throw new TypeError("A search keyword is required");
      const data = await get("/online/search", (url) => {
        url.searchParams.set("keyword", keyword);
        addPagination(url, page);
      });
      return validatePage(data, "occupation", isOccupation);
    },
    async getOccupation(code: string): Promise<OnetOccupationReport> {
      validateCode(code);
      const value = await get(`/online/occupations/${code}/`);
      if (!isRecord(value) || !isOccupation(value.occupation) ||
          typeof value.description !== "string" ||
          (value.sample_of_reported_titles !== undefined &&
            (!Array.isArray(value.sample_of_reported_titles) ||
             !value.sample_of_reported_titles.every((title: unknown) => typeof title === "string")))) {
        throw new Error("Invalid O*NET occupation response");
      }
      return value as unknown as OnetOccupationReport;
    },
    async getSkills(code: string, page: OnetPagination = {}): Promise<OnetPage<OnetSkill>> {
      validateCode(code);
      const value = await get(`/online/occupations/${code}/summary/skills`, (url) => addPagination(url, page));
      return validatePage(value, "element", isSkill);
    },
    async getInterestProfilerQuestions(page: OnetPagination = {}): Promise<InterestProfilerQuestions> {
      const value = await get("/mnm/interestprofiler/questions", (url) => addPagination(url, page));
      if (!isRecord(value) || !Number.isInteger(value.start) || !Number.isInteger(value.end) ||
          value.total !== 60 || !Array.isArray(value.answer_option) ||
          !value.answer_option.every((option: unknown) => isRecord(option) &&
            Number.isInteger(option.value) && typeof option.name === "string") ||
          !Array.isArray(value.question) ||
          !value.question.every((question: unknown) => isRecord(question) &&
            Number.isInteger(question.index) && typeof question.area === "string" &&
            typeof question.text === "string") ||
          (value.next !== undefined && typeof value.next !== "string")) {
        throw new Error("Invalid O*NET Interest Profiler questions response");
      }
      return value as unknown as InterestProfilerQuestions;
    },
    async scoreInterestProfiler(answers: string): Promise<InterestProfilerResults> {
      if (!/^[1-5]{60}$/.test(answers)) {
        throw new TypeError("Interest Profiler requires exactly 60 ordered answers from 1 to 5");
      }
      const value = await get("/mnm/interestprofiler/results", (url) => url.searchParams.set("answers", answers));
      if (!isRecord(value) || typeof value.careers !== "string" || !Array.isArray(value.result) ||
          value.result.length !== 6 || !value.result.every((item: unknown) => isRecord(item) &&
            typeof item.code === "string" && typeof item.description === "string" && Number.isInteger(item.score))) {
        throw new Error("Invalid O*NET Interest Profiler results response");
      }
      return value as unknown as InterestProfilerResults;
    },
  };
}
