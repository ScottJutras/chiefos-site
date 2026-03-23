/**
 * Rule-based expense classifier.
 *
 * Classifies an expense into one of the standard categories based on vendor
 * name and/or description text. Covers the most common small-business
 * vendors in Canada and the US.
 *
 * Returns null when no rule matches — the caller should leave the category
 * blank and let the user fill it in during review.
 *
 * This module is pure (no I/O) and safe to use on both client and server.
 */

import type { ExpenseCategory } from "./categories";

type Rule = {
  category: ExpenseCategory;
  vendorPatterns?: RegExp[];
  descriptionPatterns?: RegExp[];
};

const RULES: Rule[] = [
  // ── Materials & Supplies ───────────────────────────────────────────────
  {
    category: "materials_supplies",
    vendorPatterns: [
      /home\s*depot/i,
      /lowe['']?s/i,
      /\brona\b/i,
      /home\s*hardware/i,
      /menard['']?s/i,
      /ace\s*hardware/i,
      /true\s*value/i,
      /windsor\s*plywood/i,
      /kent\s*building/i,
      /timber\s*mart/i,
      /peavey\s*mart/i,
      /build(ers?|ing)\s*(depot|direct|supply|center|centre)/i,
      /fastenal/i,
      /westburne/i,
      /\bwesco\b/i,
      /84\s*lumber/i,
      /carter\s*lumber/i,
      /sutherland['']?s/i,
    ],
    descriptionPatterns: [
      /\b(lumber|plywood|drywall|concrete|cement|rebar|insulation|roofing|shingles|siding|framing|fasteners?|nails?|screws?|bolts?|hardware)\b/i,
    ],
  },

  // ── Meals & Entertainment ──────────────────────────────────────────────
  {
    category: "meals_entertainment",
    vendorPatterns: [
      /mcdonald['']?s/i,
      /tim\s*horton['']?s?/i,
      /\bsubway\b/i,
      /chick[\s-]*fil[\s-]*a/i,
      /wendy['']?s/i,
      /burger\s*king/i,
      /\bkfc\b/i,
      /popeye['']?s/i,
      /\ba\s*&\s*w\b/i,
      /harvey['']?s/i,
      /swiss\s*chalet/i,
      /boston\s*pizza/i,
      /\bstarbucks\b/i,
      /second\s*cup/i,
      /country\s*style/i,
      /dairy\s*queen/i,
      /pizza\s*(hut|pizza|nova|73)/i,
      /domino['']?s/i,
      /little\s*caesar['']?s/i,
      /taco\s*bell/i,
      /five\s*guys/i,
      /\bchipotle\b/i,
      /nando['']?s/i,
      /panda\s*express/i,
      /mary\s*brown['']?s/i,
      /montana['']?s/i,
      /east\s*side\s*mario['']?s/i,
      /\bdenny['']?s\b/i,
      /ihop/i,
      /waffle\s*house/i,
      /\bapplebee['']?s\b/i,
      /\bchili['']?s\b/i,
      /olive\s*garden/i,
      /red\s*lobster/i,
    ],
    descriptionPatterns: [
      /\b(breakfast|lunch|dinner|meal|food|restaurant|caf[eé]|coffee|snack|catering|hospitality)\b/i,
    ],
  },

  // ── Vehicle & Fuel ─────────────────────────────────────────────────────
  {
    category: "vehicle_fuel",
    vendorPatterns: [
      /petro[\s-]*canada/i,
      /\bshell\b/i,
      /\besso\b/i,
      /\bhusky\b/i,
      /\bultramar\b/i,
      /pioneer\s*(gas|petro)/i,
      /exxon(mobil)?/i,
      /\bmobil\b/i,
      /\bbp\b/i,
      /\bsunoco\b/i,
      /circle\s*k/i,
      /7[\s-]*eleven/i,
      /canadian\s*tire/i,
      /napa\s*auto/i,
      /\blordco\b/i,
      /fountain\s*tire/i,
      /ok\s*tire/i,
      /kal\s*tire/i,
      /jiffy\s*lube/i,
      /mr\.?\s*lube/i,
      /midas\b/i,
      /\bmonro\b/i,
      /auto\s*zone/i,
      /o['']reilly\s*auto/i,
      /advance\s*auto/i,
    ],
    descriptionPatterns: [
      /\b(fuel|gas|diesel|gasoline|oil\s*change|tire[sd]?|auto\s*parts?|vehicle|car\s*wash|windshield|wiper|antifreeze|coolant)\b/i,
    ],
  },

  // ── Tools & Equipment ──────────────────────────────────────────────────
  {
    category: "tools_equipment",
    vendorPatterns: [
      /princess\s*auto/i,
      /northern\s*tool/i,
      /\bgrainger\b/i,
      /acklands[\s-]*grainger/i,
      /\btoolmart\b/i,
      /harbour\s*freight/i,
    ],
    descriptionPatterns: [
      /\b(tool[s]?|drill|saw|circular saw|jigsaw|reciprocating|hammer|ladder|scaffold|equipment|machinery|compressor|generator|nailer|grinder|welder|impact|wrench|level|measuring)\b/i,
    ],
  },

  // ── Office & Admin ─────────────────────────────────────────────────────
  {
    category: "office_admin",
    vendorPatterns: [
      /\bstaples\b/i,
      /office\s*(depot|max)/i,
      /grand\s*&\s*toy/i,
      /bureau\s*en\s*gros/i,
      /\bfedex\b/i,
      /\bups\b/i,
      /canada\s*post/i,
      /\busps\b/i,
      /\bpurolator\b/i,
      /\bcanpar\b/i,
    ],
    descriptionPatterns: [
      /\b(office\s*suppl|printer|ink\s*cartridge|paper|postage|shipping|courier|cell(phone|\s*phone)?|internet|software\s*sub|monthly\s*sub|annual\s*sub|storage\s*sub)\b/i,
    ],
  },

  // ── Advertising ────────────────────────────────────────────────────────
  {
    category: "advertising",
    vendorPatterns: [
      /\bmeta\b/i,
      /facebook\s*ads?/i,
      /google\s*(ads?|workspace)/i,
      /instagram\s*ads?/i,
      /tiktok\s*ads?/i,
    ],
    descriptionPatterns: [
      /\b(advert|marketing|promo|signage|banner|flyer|brochure|business\s*card|print\s*ad|social\s*media\s*ad)\b/i,
    ],
  },

  // ── Professional Fees ──────────────────────────────────────────────────
  {
    category: "professional_fees",
    vendorPatterns: [
      /quickbooks/i,
      /freshbooks/i,
      /\bxero\b/i,
      /\bsage\b/i,
    ],
    descriptionPatterns: [
      /\b(lawyer|legal\s*fee|accountant|accounting\s*fee|consultant|engineering\s*fee|permit|inspection\s*fee|license\s*fee|professional\s*fee|insurance\s*premium)\b/i,
    ],
  },

  // ── Travel ─────────────────────────────────────────────────────────────
  {
    category: "travel",
    vendorPatterns: [
      /\bairbnb\b/i,
      /\bhotel\b/i,
      /\bmotel\b/i,
      /\bmarriott\b/i,
      /\bhilton\b/i,
      /\byyz\b|\byvr\b|\byul\b|\byow\b/i, // Canadian airports
      /air\s*canada/i,
      /westjet/i,
      /porter\s*air/i,
      /\bunitedair\b|\bunited\s*air/i,
      /american\s*airlines/i,
      /delta\s*air/i,
      /southwest\s*air/i,
    ],
    descriptionPatterns: [
      /\b(hotel|motel|flight|airfare|airport|parking\s*garage|taxi|uber|lyft|rideshare|accommodation|lodging|per\s*diem)\b/i,
    ],
  },
];

export type ClassifyResult = {
  category: ExpenseCategory | null;
  /** "rule" = matched a pattern, null = no match */
  source: "rule" | null;
};

/**
 * Classify an expense by vendor and/or description.
 * Returns `{ category: null, source: null }` when no rule matches.
 */
export function classifyExpense(
  vendor: string | null | undefined,
  description: string | null | undefined
): ClassifyResult {
  const v = String(vendor ?? "").trim();
  const d = String(description ?? "").trim();

  for (const rule of RULES) {
    if (v && rule.vendorPatterns?.some((rx) => rx.test(v))) {
      return { category: rule.category, source: "rule" };
    }
    if (d && rule.descriptionPatterns?.some((rx) => rx.test(d))) {
      return { category: rule.category, source: "rule" };
    }
  }

  return { category: null, source: null };
}
