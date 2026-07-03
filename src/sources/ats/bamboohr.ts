import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { toIsoDate } from "../common/date.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import { mapWithConcurrency } from "../common/concurrency.js";
import type { AtsScraper } from "./base.js";

/**
 * Live-verified against several real BambooHR-hosted careers pages (soundstripe,
 * beehiiv, 401auto, flyio, avaindustries — all public, unauthenticated
 * `*.bamboohr.com/careers/...` endpoints) while building this provider. The
 * community-documented schema in the task plan turned out to be wrong in several
 * ways:
 *   - The list endpoint's top-level shape is `{ meta, result: [...] }` — a bare
 *     array of jobs under `result`, NOT `{ result: { jobs: [...] } }`.
 *   - The list entries have no `postingUrl`, `datePosted`, or flat
 *     `city`/`state`/`country`/`isRemote` fields. Location is nested under two
 *     objects: `location` (physical address, populated for on-site postings) and
 *     `atsLocation` (populated instead of `location` for remote/flexible
 *     postings). `isRemote` is always `null` in the wild; the real remote signal
 *     is the string `locationType` ("0" = on-site, "1" = remote/flexible).
 *   - The detail endpoint's shape is `{ result: { jobOpening: { ... } } }`, not
 *     `{ result: { description } }`. The apply URL (`jobOpeningShareUrl`) and
 *     `datePosted` only exist on the detail response, not the list response —
 *     confirming the per-job detail fetch in this task is required, not optional.
 * The apply URL follows a fixed, predictable pattern
 * (`https://{slug}.bamboohr.com/careers/{id}`), so it's reconstructed as a
 * fallback if a given job's detail fetch fails.
 */

interface BambooLocation {
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  addressCountry?: string | null;
}

interface BambooAtsLocation {
  country?: string | null;
  state?: string | null;
  province?: string | null;
  city?: string | null;
}

interface BambooListJob {
  id: string;
  jobOpeningName: string;
  location?: BambooLocation | null;
  atsLocation?: BambooAtsLocation | null;
  isRemote?: boolean | null;
  locationType?: string | null;
}

interface BambooListResponse {
  result: BambooListJob[];
}

interface BambooJobOpening {
  jobOpeningShareUrl: string;
  jobOpeningName: string;
  description?: string | null;
  datePosted?: string | null;
  location?: BambooLocation | null;
  atsLocation?: BambooAtsLocation | null;
  isRemote?: boolean | null;
  locationType?: string | null;
}

interface BambooDetailResponse {
  result: { jobOpening: BambooJobOpening };
}

const DETAIL_CONCURRENCY = 5;

function toJob(raw: BambooListJob, detail: BambooJobOpening | null, slug: string): NewJob {
  const applyUrl = detail?.jobOpeningShareUrl ?? `https://${slug}.bamboohr.com/careers/${raw.id}`;
  const atsLoc = detail?.atsLocation ?? raw.atsLocation;
  const physLoc = detail?.location ?? raw.location;
  const locationText =
    [atsLoc?.city, atsLoc?.state, atsLoc?.country].filter(Boolean).join(", ") ||
    [physLoc?.city, physLoc?.state].filter(Boolean).join(", ") ||
    null;
  const loc = parseLocation(locationText);
  const locationType = detail?.locationType ?? raw.locationType;
  const isRemoteFlag = detail?.isRemote ?? raw.isRemote;

  return {
    id: jobId(applyUrl),
    title: detail?.jobOpeningName ?? raw.jobOpeningName,
    company: humanizeSlug(slug),
    location: loc.location,
    city: atsLoc?.city ?? physLoc?.city ?? loc.city,
    region: atsLoc?.state ?? physLoc?.state ?? loc.region,
    country: atsLoc?.country ?? physLoc?.addressCountry ?? loc.country,
    seniority: deriveSeniority(raw.jobOpeningName),
    isRemote: isRemoteFlag === true || locationType === "1" || loc.isRemote,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl,
    description: detail?.description ? stripHtml(detail.description) : null,
    datePosted: toIsoDate(detail?.datePosted ?? null),
    platform: "bamboohr",
    source: "ats",
  };
}

export const bamboohr: AtsScraper = {
  platform: "bamboohr",
  async fetch(slug: string): Promise<NewJob[]> {
    const list = await fetchJson<BambooListResponse>(`https://${slug}.bamboohr.com/careers/list`);
    const jobs = list.result ?? [];

    const details = await mapWithConcurrency(jobs, DETAIL_CONCURRENCY, async (j) => {
      try {
        const detail = await fetchJson<BambooDetailResponse>(
          `https://${slug}.bamboohr.com/careers/${j.id}/detail`,
        );
        return detail.result.jobOpening;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[bamboohr] failed to fetch detail for job ${j.id}: ${msg}`);
        return null;
      }
    });

    return mapSkipInvalid(
      jobs.map((job, i) => ({ job, detail: details[i] })),
      ({ job, detail }) => toJob(job, detail, slug),
      "bamboohr",
    );
  },
};
