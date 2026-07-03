import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

interface JobScoreJob {
  title: string;
  company_name: string;
  apply_url: string;
  detail_url: string;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  last_updated_date?: string | null;
  opened_date?: string | null;
  description?: string | null;
  remote?: string | null;
}

interface JobScoreFeed {
  jobs: JobScoreJob[];
}

function toJob(raw: JobScoreJob): NewJob {
  const locationText = raw.location ?? ([raw.city, raw.state, raw.country].filter(Boolean).join(", ") || null);
  const loc = parseLocation(locationText);
  const applyUrl = raw.apply_url || raw.detail_url;
  const remoteFlag = typeof raw.remote === "string" && raw.remote.toLowerCase().startsWith("yes");
  return {
    id: jobId(applyUrl),
    title: raw.title,
    company: raw.company_name,
    location: loc.location,
    city: loc.city ?? raw.city ?? null,
    region: loc.region ?? raw.state ?? null,
    country: loc.country ?? raw.country ?? null,
    seniority: deriveSeniority(raw.title),
    isRemote: remoteFlag || loc.isRemote,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl,
    description: stripHtml(raw.description),
    datePosted: toIsoDate(raw.opened_date ?? raw.last_updated_date ?? null),
    platform: "jobscore",
    source: "ats",
  };
}

export const jobscore: AtsScraper = {
  platform: "jobscore",
  async fetch(slug: string): Promise<NewJob[]> {
    const feed = await fetchJson<JobScoreFeed>(`https://careers.jobscore.com/jobs/${slug}/feed.json`);
    return mapSkipInvalid(feed.jobs, toJob, "jobscore");
  },
};
