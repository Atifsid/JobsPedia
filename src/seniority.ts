export const SENIORITY_LEVELS = [
  "internship",
  "entry",
  "mid",
  "senior",
  "lead",
  "staff",
  "principal",
] as const;
export type Seniority = (typeof SENIORITY_LEVELS)[number];

// Checked in order, first match wins — needed because a title like "Senior
// Staff Engineer" matches more than one rule and the more specific/senior
// level should win.
const RULES: Array<[RegExp, Seniority]> = [
  [/\bprincipal\b/i, "principal"],
  [/\bstaff\b/i, "staff"],
  [/\blead\b/i, "lead"],
  [/\b(senior|sr\.?)\b/i, "senior"],
  [/\b(junior|jr\.?|associate|new grad|graduate|entry)\b/i, "entry"],
  [/\bintern(ship)?\b/i, "internship"],
];

/** Best-effort, title-based seniority classification. Defaults to "mid" when no rule matches. */
export function deriveSeniority(title: string): Seniority {
  for (const [pattern, level] of RULES) {
    if (pattern.test(title)) return level;
  }
  return "mid";
}
