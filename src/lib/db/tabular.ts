/** Parse RFC 4180-style delimited text, including quoted newlines and escaped quotes. */
export function parseDelimited(input: string, delimiter: string): string[][] {
  if (delimiter.length !== 1 || delimiter === '"' || delimiter === "\n" || delimiter === "\r") {
    throw new Error("Delimiter must be one character other than a quote or newline");
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  input = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += c;
    } else if (c === '"') {
      if (field || closed) throw new Error("Unexpected quote in unquoted field");
      quoted = true;
    } else if (c === delimiter) {
      row.push(field); field = ""; closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = ""; closed = false;
    } else {
      if (closed) throw new Error("Unexpected character after closing quote");
      field += c;
    }
  }
  if (quoted) throw new Error("Unterminated quoted field");
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}

export type Column = string | string[] | { value: string | number | boolean };
export type SourceConfig = {
  file: string;
  delimiter?: string;
  columns?: Record<string, Column>;
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export function mapRows(
  input: string,
  config: SourceConfig,
  defaults: Record<string, string | string[]>,
  required: string[],
): Record<string, string>[] {
  const rows = parseDelimited(input, config.delimiter ?? (config.file.toLowerCase().endsWith(".csv") ? "," : "\t"));
  const headers = rows.shift();
  if (!headers) throw new Error(`${config.file}: missing header`);
  const indices = new Map<string, number>();
  headers.forEach((header, i) => {
    const key = normalize(header);
    if (!key || indices.has(key)) throw new Error(`${config.file}: empty or ambiguous header "${header}"`);
    indices.set(key, i);
  });
  const columns = { ...defaults, ...config.columns };
  for (const [key, column] of Object.entries(columns)) {
    if (Array.isArray(column) ? !column.length || column.some((value) => typeof value !== "string") : typeof column !== "string" && (!column || !("value" in column) || column.value === null || column.value === undefined)) {
      throw new Error(`${config.file}: invalid column mapping for ${key}`);
    }
  }
  const indexOf = (column: string | string[]) => (Array.isArray(column) ? column : [column])
    .map((name) => indices.get(normalize(name))).find((index) => index !== undefined);
  for (const key of required) {
    const col = columns[key];
    if (!col || ((typeof col === "string" || Array.isArray(col)) && indexOf(col) === undefined)) {
      throw new Error(`${config.file}: missing required column mapping for ${key}`);
    }
  }
  return rows.flatMap((row, i) => {
    if (row.length === 1 && row[0].trim() === "") return [];
    if (row.length !== headers.length) throw new Error(`${config.file}:${i + 2}: expected ${headers.length} columns, got ${row.length}`);
    const result: Record<string, string> = {};
    for (const [key, column] of Object.entries(columns)) {
      const index = typeof column === "string" || Array.isArray(column) ? indexOf(column) : undefined;
      if (typeof column !== "string" && !Array.isArray(column)) result[key] = String(column.value).trim();
      else if (index !== undefined) result[key] = row[index].trim();
    }
    for (const key of required) if (!result[key]) throw new Error(`${config.file}:${i + 2}: ${key} is required`);
    return [result];
  });
}
