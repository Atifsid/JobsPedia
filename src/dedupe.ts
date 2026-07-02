import type { NewJob } from "./schema.js";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fuzzyKey(job: NewJob): string {
  const loc = normalize(job.city ?? job.location ?? "");
  return `${normalize(job.company)}|${normalize(job.title)}|${loc}`;
}

function fillGaps(primary: NewJob, other: NewJob): NewJob {
  return {
    ...primary,
    location: primary.location ?? other.location,
    city: primary.city ?? other.city,
    region: primary.region ?? other.region,
    country: primary.country ?? other.country,
    salaryMin: primary.salaryMin ?? other.salaryMin,
    salaryMax: primary.salaryMax ?? other.salaryMax,
    currency: primary.currency ?? other.currency,
    description: primary.description ?? other.description,
    datePosted: primary.datePosted ?? other.datePosted,
  };
}

/** Merge a group of records that all represent the same posting. ATS-direct wins ties; gaps fill from the rest. */
function mergeGroup(group: NewJob[]): NewJob {
  if (group.length === 1) return group[0];
  const primary = group.find((j) => j.source === "ats") ?? group[0];
  return group.filter((j) => j !== primary).reduce(fillGaps, primary);
}

function groupBy(jobs: NewJob[], keyOf: (job: NewJob) => string): NewJob[][] {
  const groups = new Map<string, NewJob[]>();
  for (const job of jobs) {
    const key = keyOf(job);
    const group = groups.get(key);
    if (group) group.push(job);
    else groups.set(key, [job]);
  }
  return [...groups.values()];
}

/**
 * Collapse duplicate postings across ATS-direct and aggregator sources.
 *
 * 1. Primary key: canonical apply URL (already baked into `id` by each source's `jobId()` call —
 *    aggregator adapters resolve the direct ATS URL when the board exposes one).
 * 2. Fallback: fuzzy match on normalized company + title + city, for postings whose apply URL
 *    differs (e.g. the aggregator only had the board's own URL, not the direct ATS link).
 * 3. ATS-direct wins ties; gaps in the winning record are filled from the losing one(s).
 */
export function dedupeAndMerge(jobs: NewJob[]): NewJob[] {
  const byUrlId = groupBy(jobs, (j) => j.id).map(mergeGroup);

  // The fuzzy pass exists to bridge the SAME posting across sources (an ATS-direct
  // listing and its aggregator repost, reachable via different URLs). It must not
  // fire within a single source: a company can legitimately have several distinct,
  // separately-req'd openings with the same title/company/city (e.g. multiple
  // "Software Engineer" reqs across teams) — those are not duplicates.
  const result: NewJob[] = [];
  for (const group of groupBy(byUrlId, fuzzyKey)) {
    const sources = new Set(group.map((j) => j.source));
    if (group.length > 1 && sources.size > 1) {
      result.push(mergeGroup(group));
    } else {
      result.push(...group);
    }
  }
  return result;
}
