import { scrapeJobs, type ScrapeJobsParams } from "jobspy-js";
import { jobId } from "../lib/id.js";
import { deriveSeniority } from "../seniority.js";
import type { NewJob, Platform } from "../schema.js";
import { stripHtml } from "./common/html.js";
import { parseLocation } from "./common/location.js";
import { sanitizeSalary } from "./common/salary.js";

interface FlatJobRecord {
  site: string;
  job_url: string;
  job_url_direct?: string;
  title: string;
  company?: string;
  location?: string;
  date_posted?: string;
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  is_remote?: boolean;
  description?: string;
}

function toJob(raw: FlatJobRecord): NewJob | null {
  if (!raw.title || !raw.job_url) return null;
  const applyUrl = raw.job_url_direct || raw.job_url;
  const loc = parseLocation(raw.location);
  const { salaryMin, salaryMax } = sanitizeSalary(raw.min_amount, raw.max_amount);
  return {
    id: jobId(applyUrl),
    title: raw.title,
    company: raw.company?.trim() || "Unknown",
    location: loc.location,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    seniority: deriveSeniority(raw.title),
    isRemote: Boolean(raw.is_remote) || loc.isRemote,
    salaryMin,
    salaryMax,
    currency: raw.currency ?? null,
    applyUrl,
    description: stripHtml(raw.description ?? null),
    datePosted: raw.date_posted ?? null,
    platform: raw.site as Platform,
    source: "aggregator",
  };
}

/** Adapter over jobspy-js: aggregator boards (LinkedIn, Indeed, Glassdoor, ...) -> Job[]. */
export async function fetchAggregatorJobs(params: ScrapeJobsParams): Promise<NewJob[]> {
  const { jobs } = await scrapeJobs(params);
  const result: NewJob[] = [];
  for (const raw of jobs as FlatJobRecord[]) {
    const job = toJob(raw);
    if (job) result.push(job);
  }
  return result;
}
