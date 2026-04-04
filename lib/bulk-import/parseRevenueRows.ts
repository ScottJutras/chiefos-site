// lib/bulk-import/parseRevenueRows.ts
// Parses raw CSV into validated revenue rows.

export type ParsedRevenueRow = {
  date: string;
  amount_cents: number;
  source: string;
  category: string | null;
  description: string;
  job_name: string | null;
};

export type InvalidRevenueRow = {
  row: Record<string, string>;
  errors: string[];
};

export type ParseRevenueResult = {
  valid: ParsedRevenueRow[];
  invalid: InvalidRevenueRow[];
};

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let val = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { val += line[i++]; }
      }
      result.push(val);
      if (line[i] === ",") i++;
    } else {
      let val = "";
      while (i < line.length && line[i] !== ",") val += line[i++];
      result.push(val);
      if (line[i] === ",") i++;
    }
  }
  return result;
}

function parseCSV(text: string) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (!lines.length) return { rows: [] };
  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i]);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => { rec[h] = (vals[idx] ?? "").trim(); });
    rows.push(rec);
  }
  return { rows };
}

function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year  = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normaliseAmountCents(raw: string): number | null {
  const n = parseFloat(raw.replace(/[$,\s]/g, ""));
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function pickField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) { if (row[k] !== undefined && row[k] !== "") return row[k]; }
  return "";
}

export function parseRevenueRows(csvText: string): ParseRevenueResult {
  const { rows } = parseCSV(csvText);
  const valid: ParsedRevenueRow[] = [];
  const invalid: InvalidRevenueRow[] = [];

  for (const row of rows) {
    if (Object.values(row).every((v) => !v.trim())) continue;
    const errors: string[] = [];

    const rawDate   = pickField(row, "date", "revenue_date", "occurred_on");
    const rawAmount = pickField(row, "amount", "total", "revenue", "payment");
    const source    = pickField(row, "source", "client", "customer", "vendor", "payee").trim();
    const category  = pickField(row, "category", "revenue_category", "type").trim() || null;
    const desc      = pickField(row, "description", "memo", "note", "notes").trim();
    const jobName   = pickField(row, "job_name", "job", "project").trim() || null;

    const date = normaliseDate(rawDate);
    if (!date) errors.push(`Invalid date: "${rawDate}"`);

    const amountCents = normaliseAmountCents(rawAmount);
    if (amountCents === null) errors.push(`Invalid amount: "${rawAmount}"`);

    if (errors.length) {
      invalid.push({ row, errors });
    } else {
      valid.push({
        date: date!,
        amount_cents: amountCents!,
        source: source || "Unknown",
        category,
        description: desc || source || "Imported revenue",
        job_name: jobName,
      });
    }
  }

  return { valid, invalid };
}
