import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { toIsoDate } from "../common/date.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

interface BreezyJob {
  url: string;
  name: string;
  published_date?: string | null;
  location?: { name?: string | null; is_remote?: boolean } | null;
  company?: { name?: string | null } | null;
  description?: string | null;
}

function toJob(raw: BreezyJob, slug: string): NewJob {
  const loc = parseLocation(raw.location?.name ?? null);
  return {
    id: jobId(raw.url),
    title: raw.name,
    company: raw.company?.name || humanizeSlug(slug),
    location: loc.location,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    seniority: deriveSeniority(raw.name),
    isRemote: raw.location?.is_remote === true || loc.isRemote,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: raw.url,
    description: stripHtml(raw.description),
    datePosted: toIsoDate(raw.published_date ?? null),
    platform: "breezyhr",
    source: "ats",
  };
}

export const breezyhr: AtsScraper = {
  platform: "breezyhr",
  async fetch(slug: string): Promise<NewJob[]> {
    const jobs = await fetchJson<BreezyJob[]>(`https://${slug}.breezy.hr/json`);
    return mapSkipInvalid(jobs, (j) => toJob(j, slug), "breezyhr");
  },
};
