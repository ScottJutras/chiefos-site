// lib/bulk-import/parseTimeRows.ts
// Parses raw CSV into validated time entry rows.
// Accepts: hours (with synthetic clock_in/out) OR clock_in + clock_out timestamps.

export type ParsedTimeRow = {
  date: string;        // ISO YYYY-MM-DD (local date of shift)
  employee_name: string;
  start_at_utc: string; // ISO 8601 timestamptz
  end_at_utc: string;   // ISO 8601 timestamptz
  hours: number;        // decimal hours, computed
  job_name: string | null;
};

export type InvalidTimeRow = {
  row: Record<string, string>;
  errors: string[];
};

export type ParseTimeResult = {
  valid: ParsedTimeRow[];
  invalid: InvalidTimeRow[];
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
  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/[\s\-]/g, "_"));
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
    const year = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function pickField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) { if (row[k] !== undefined && row[k] !== "") return row[k]; }
  return "";
}

// Treat date + "HH:MM" (24-hour local) as a UTC ISO timestamp (simple: assume UTC)
function dateTimeToUtc(dateIso: string, time: string): string {
  const safeTime = time.trim() || "08:00";
  const dt = new Date(`${dateIso}T${safeTime}:00Z`);
  return dt.toISOString();
}

export function parseTimeRows(csvText: string): ParseTimeResult {
  const { rows } = parseCSV(csvText);
  const valid: ParsedTimeRow[] = [];
  const invalid: InvalidTimeRow[] = [];

  for (const row of rows) {
    if (Object.values(row).every((v) => !v.trim())) continue;
    const errors: string[] = [];

    const rawDate      = pickField(row, "date", "shift_date", "work_date");
    const employeeName = pickField(row, "employee_name", "employee", "worker", "name", "user").trim();
    const rawHours     = pickField(row, "hours", "hrs", "duration");
    const rawClockIn   = pickField(row, "clock_in", "start", "start_time");
    const rawClockOut  = pickField(row, "clock_out", "end", "end_time");
    const jobName      = pickField(row, "job_name", "job", "project").trim() || null;

    const date = normaliseDate(rawDate);
    if (!date) errors.push(`Invalid date: "${rawDate}"`);
    if (!employeeName) errors.push("employee_name is required");

    if (errors.length) { invalid.push({ row, errors }); continue; }

    let start_at_utc: string;
    let end_at_utc: string;
    let hours: number;

    if (rawClockIn && rawClockOut) {
      // clock_in / clock_out provided directly
      const s = new Date(rawClockIn.includes("T") ? rawClockIn : `${date!}T${rawClockIn}:00Z`);
      const e = new Date(rawClockOut.includes("T") ? rawClockOut : `${date!}T${rawClockOut}:00Z`);

      if (isNaN(s.getTime())) { invalid.push({ row, errors: [`Invalid clock_in: "${rawClockIn}"`] }); continue; }
      if (isNaN(e.getTime())) { invalid.push({ row, errors: [`Invalid clock_out: "${rawClockOut}"`] }); continue; }
      if (e <= s) { invalid.push({ row, errors: ["clock_out must be after clock_in"] }); continue; }

      start_at_utc = s.toISOString();
      end_at_utc   = e.toISOString();
      hours = (e.getTime() - s.getTime()) / 3_600_000;
    } else if (rawHours) {
      const h = parseFloat(rawHours);
      if (!isFinite(h) || h <= 0) { invalid.push({ row, errors: [`Invalid hours: "${rawHours}"`] }); continue; }
      start_at_utc = dateTimeToUtc(date!, "08:00");
      const endMs  = new Date(start_at_utc).getTime() + h * 3_600_000;
      end_at_utc   = new Date(endMs).toISOString();
      hours = h;
    } else {
      invalid.push({ row, errors: ["Provide either hours or clock_in + clock_out"] });
      continue;
    }

    valid.push({
      date: date!,
      employee_name: employeeName,
      start_at_utc,
      end_at_utc,
      hours,
      job_name: jobName,
    });
  }

  return { valid, invalid };
}
