import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { adzunaConfig } from "../../config.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { sanitizeSalary } from "../common/salary.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import type { ApiProvider } from "./base.js";

interface AdzunaJob {
  title: string;
  company: { display_name: string };
  location: { display_name: string | null } | null;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  created: string | null;
  redirect_url: string;
}

interface AdzunaResponse {
  results: AdzunaJob[];
}

function toJob(raw: AdzunaJob): NewJob {
  const loc = parseLocation(raw.location?.display_name ?? null);
  const { salaryMin, salaryMax } = sanitizeSalary(raw.salary_min, raw.salary_max);
  return {
    id: jobId(raw.redirect_url),
    title: raw.title,
    company: raw.company.display_name,
    location: loc.location,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    seniority: deriveSeniority(raw.title),
    isRemote: loc.isRemote,
    visaSponsorship: null,
    salaryMin,
    salaryMax,
    currency: null,
    applyUrl: raw.redirect_url,
    description: stripHtml(raw.description),
    datePosted: toIsoDate(raw.created),
    platform: "adzuna",
    source: "aggregator",
  };
}

function getCredentials(): { appId: string; appKey: string } {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("ADZUNA_APP_ID/ADZUNA_APP_KEY not set — see README's Setup section");
  }
  return { appId, appKey };
}

async function fetchCountryTerm(
  country: string,
  term: string,
  appId: string,
  appKey: string,
): Promise<AdzunaResponse> {
  const url =
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1` +
    `?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}` +
    `&results_per_page=${adzunaConfig.resultsPerPage}&what=${encodeURIComponent(term)}` +
    `&content-type=application/json`;
  return fetchJson<AdzunaResponse>(url);
}

export const adzuna: ApiProvider = {
  platform: "adzuna",
  async fetch(): Promise<NewJob[]> {
    const { appId, appKey } = getCredentials();
    const jobs: NewJob[] = [];
    for (const country of adzunaConfig.countries) {
      for (const term of adzunaConfig.searchTerms) {
        const data = await fetchCountryTerm(country, term, appId, appKey);
        jobs.push(...mapSkipInvalid(data.results, toJob, "adzuna"));
      }
    }
    return jobs;
  },
};
