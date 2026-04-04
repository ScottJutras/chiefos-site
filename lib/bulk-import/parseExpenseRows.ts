// lib/bulk-import/parseExpenseRows.ts
// Parses a raw CSV string (or pre-split rows array) into validated expense rows.
// No external dependencies — uses only built-in JS.

export type ParsedExpenseRow = {
  date: string;         // ISO YYYY-MM-DD
  amount_cents: number; // positive integer
  vendor: string;
  category: string | null;
  description: string;
  job_name: string | null;
};

export type InvalidExpenseRow = {
  row: Record<string, string>;
  errors: string[];
};

export type ParseExpenseResult = {
  valid: ParsedExpenseRow[];
  invalid: InvalidExpenseRow[];
};

// ─── CSV parser (RFC 4180) ────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = splitCSVLine(nonEmpty[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_")
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const vals = splitCSVLine(nonEmpty[i]);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = (vals[idx] ?? "").trim();
    });
    rows.push(rec);
  }
  return { headers, rows };
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let val = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          val += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          val += line[i++];
        }
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

// ─── Field normalisers ────────────────────────────────────────────────────────

function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY or DD/MM/YYYY (treat as MM/DD/YYYY if unambiguous)
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    const year = y.length === 2 ? "20" + y : y;
    const month = a.padStart(2, "0");
    const day   = b.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Try native Date parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function normaliseAmountCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

// ─── Column aliases ───────────────────────────────────────────────────────────

function pickField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return "";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseExpenseRows(csvText: string): ParseExpenseResult {
  const { rows } = parseCSV(csvText);
  const valid: ParsedExpenseRow[] = [];
  const invalid: InvalidExpenseRow[] = [];

  for (const row of rows) {
    // Skip blank rows
    if (Object.values(row).every((v) => !v.trim())) continue;

    const errors: string[] = [];

    const rawDate   = pickField(row, "date", "expense_date", "occurred_on");
    const rawAmount = pickField(row, "amount", "total", "cost", "price");
    const vendor    = pickField(row, "vendor", "source", "payee", "supplier").trim();
    const category  = pickField(row, "category", "expense_category", "type").trim() || null;
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
        vendor: vendor || "Unknown",
        category,
        description: desc || vendor || "Imported expense",
        job_name: jobName,
      });
    }
  }

  return { valid, invalid };
}
