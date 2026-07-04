import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { sanitizeSalary } from "../common/salary.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

interface PinpointLocation {
  city?: string | null;
  province?: string | null;
}

interface PinpointPosting {
  title: string;
  url: string;
  compensation_minimum?: number | null;
  compensation_maximum?: number | null;
  compensation_currency?: string | null;
  workplace_type_text?: string | null;
  description?: string | null;
  location?: PinpointLocation | null;
}

function toJob(raw: PinpointPosting, tenant: string): NewJob {
  const locText = [raw.location?.city, raw.location?.province].filter(Boolean).join(", ") || null;
  const loc = parseLocation(locText);
  const { salaryMin, salaryMax } = sanitizeSalary(raw.compensation_minimum ?? null, raw.compensation_maximum ?? null);
  return {
    id: jobId(raw.url),
    title: raw.title,
    company: humanizeSlug(tenant),
    location: loc.location,
    city: raw.location?.city ?? loc.city,
    region: raw.location?.province ?? loc.region,
    country: loc.country,
    seniority: deriveSeniority(raw.title),
    isRemote: raw.workplace_type_text?.toLowerCase() === "remote" || loc.isRemote,
    visaSponsorship: null,
    salaryMin,
    salaryMax,
    currency: raw.compensation_currency ?? null,
    applyUrl: raw.url,
    description: stripHtml(raw.description),
    datePosted: null,
    platform: "pinpoint",
    source: "ats",
  };
}

export const pinpoint: AtsScraper = {
  platform: "pinpoint",
  async fetch(tenant: string): Promise<NewJob[]> {
    const postings = await fetchJson<PinpointPosting[]>(`https://${tenant}.pinpointhq.com/postings.json`);
    return mapSkipInvalid(postings, (p) => toJob(p, tenant), "pinpoint");
  },
};
