import { parse } from "csv-parse/sync";
import type { NewJob } from "./schema.js";
import { fetchText } from "./sources/common/http.js";

// Matches a single trailing legal-entity suffix (optionally preceded by a comma and
// followed by a period) anchored to the end of the string — e.g. ", Inc." in
// "Acme Corp, Inc." — so only the outermost suffix is stripped, not every suffix-like
// word anywhere in the name.
const LEGAL_SUFFIX_RE =
  /[,.]?\s*\b(inc|incorporated|llc|l\.l\.c|corp|corporation|co|ltd|limited|lp|l\.p|pllc|pc|p\.c)\b\.?\s*$/i;

/** Normalize a company name for cross-source matching: lowercase, strip legal suffixes/punctuation, collapse whitespace. */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(LEGAL_SUFFIX_RE, "")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface UscisRow {
  Employer: string;
  "Initial Approval": string;
  "Continuing Approval": string;
}

const YEARS_TO_TRY = 6;

/** Download the most recent available USCIS H-1B Employer Data Hub export. */
async function fetchLatestExport(): Promise<string> {
  const startYear = new Date().getFullYear() + 1;
  let lastErr: unknown;
  for (let year = startYear; year > startYear - YEARS_TO_TRY; year--) {
    try {
      return await fetchText(`https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-${year}.csv`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `no USCIS H-1B employer data export found in the last ${YEARS_TO_TRY} years: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

/** Parse a USCIS approval-count field, stripping thousands separators (e.g. "1,000") before converting to a number. */
function parseCount(value: string): number {
  return Number(value.replace(/,/g, ""));
}

/** Fetch and parse the latest USCIS H-1B export into a set of normalized employer names with at least one approval. */
export async function fetchH1BSponsors(): Promise<Set<string>> {
  const csv = await fetchLatestExport();
  const rows = parse(csv, { columns: true, skip_empty_lines: true }) as UscisRow[];
  const sponsors = new Set<string>();
  for (const row of rows) {
    const approvals = parseCount(row["Initial Approval"]) + parseCount(row["Continuing Approval"]);
    if (approvals > 0 && row.Employer) {
      sponsors.add(normalizeCompanyName(row.Employer));
    }
  }
  return sponsors;
}

/** Tag each job's visaSponsorship true when its normalized company matches a known H-1B sponsor. Never downgrades an existing true, never sets false. */
export function tagVisaSponsorship(jobs: NewJob[], sponsors: Set<string>): NewJob[] {
  return jobs.map((job) => {
    if (job.visaSponsorship === true) return job;
    if (sponsors.has(normalizeCompanyName(job.company))) {
      return { ...job, visaSponsorship: true };
    }
    return job;
  });
}
