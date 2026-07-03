import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

interface WorkableJob {
  title: string;
  application_url: string;
  url: string;
  telecommuting?: boolean;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  published_on?: string | null;
  created_at?: string | null;
  description?: string | null;
}

interface WorkableAccount {
  name: string;
  jobs: WorkableJob[];
}

function toJob(raw: WorkableJob, companyName: string): NewJob {
  const locationText = [raw.city, raw.state, raw.country].filter(Boolean).join(", ") || null;
  const loc = parseLocation(locationText);
  const applyUrl = raw.application_url || raw.url;
  return {
    id: jobId(applyUrl),
    title: raw.title,
    company: companyName,
    location: loc.location,
    city: loc.city ?? raw.city ?? null,
    region: loc.region ?? raw.state ?? null,
    country: loc.country ?? raw.country ?? null,
    seniority: deriveSeniority(raw.title),
    isRemote: raw.telecommuting === true || loc.isRemote,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl,
    description: stripHtml(raw.description),
    datePosted: toIsoDate(raw.published_on ?? raw.created_at ?? null),
    platform: "workable",
    source: "ats",
  };
}

export const workable: AtsScraper = {
  platform: "workable",
  async fetch(slug: string): Promise<NewJob[]> {
    const data = await fetchJson<WorkableAccount>(
      `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`,
    );
    return mapSkipInvalid(data.jobs, (j) => toJob(j, data.name), "workable");
  },
};
