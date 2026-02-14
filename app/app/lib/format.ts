export function money(n: number | null | undefined) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function qty(n: number | null | undefined) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}
