/**
 * Shared expense category definitions.
 * Values are stored in the DB; labels and tax references are display-only.
 */

export type ExpenseCategory =
  | "materials_supplies"
  | "meals_entertainment"
  | "vehicle_fuel"
  | "subcontractors"
  | "tools_equipment"
  | "office_admin"
  | "professional_fees"
  | "travel"
  | "advertising"
  | "other";

export type CountryCode = "CA" | "US";

export type CategoryMeta = {
  value: ExpenseCategory;
  label: string;
  /** CRA T2125 line reference (Canada) */
  craLine: string | null;
  /** IRS Schedule C line reference (US) */
  irsLine: string | null;
  /**
   * Canada only: meals & entertainment expenses are only 50% ITC-eligible.
   * This flag signals that the claimable amount should be halved on the CA export.
   */
  halfItcCA: boolean;
};

export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  {
    value: "materials_supplies",
    label: "Materials & Supplies",
    craLine: "8811",
    irsLine: "Line 22",
    halfItcCA: false,
  },
  {
    value: "meals_entertainment",
    label: "Meals & Entertainment",
    craLine: "8523",
    irsLine: "Line 24b",
    halfItcCA: true, // 50% ITC rule in Canada
  },
  {
    value: "vehicle_fuel",
    label: "Vehicle & Fuel",
    craLine: "9281",
    irsLine: "Line 9",
    halfItcCA: false,
  },
  {
    value: "subcontractors",
    label: "Subcontractors",
    craLine: "8710",
    irsLine: "Line 11",
    halfItcCA: false,
  },
  {
    value: "tools_equipment",
    label: "Tools & Equipment",
    craLine: "8811",
    irsLine: "Line 22",
    halfItcCA: false,
  },
  {
    value: "office_admin",
    label: "Office & Admin",
    craLine: "8810",
    irsLine: "Line 18",
    halfItcCA: false,
  },
  {
    value: "professional_fees",
    label: "Professional Fees",
    craLine: "8860",
    irsLine: "Line 17",
    halfItcCA: false,
  },
  {
    value: "travel",
    label: "Travel",
    craLine: "9200",
    irsLine: "Line 24a",
    halfItcCA: false,
  },
  {
    value: "advertising",
    label: "Advertising",
    craLine: "8520",
    irsLine: "Line 8",
    halfItcCA: false,
  },
  {
    value: "other",
    label: "Other",
    craLine: null,
    irsLine: null,
    halfItcCA: false,
  },
];

export function getCategoryMeta(value: string | null | undefined): CategoryMeta | null {
  if (!value) return null;
  return EXPENSE_CATEGORIES.find((c) => c.value === value) ?? null;
}

export function categoryLabel(value: string | null | undefined): string {
  return getCategoryMeta(value)?.label ?? "";
}

/** Returns the tax reference string appropriate for the user's country. */
export function categoryTaxRef(value: string | null | undefined, country: CountryCode): string {
  const meta = getCategoryMeta(value);
  if (!meta) return "";
  if (country === "CA") return meta.craLine ? `CRA ${meta.craLine}` : "";
  return meta.irsLine ?? "";
}
