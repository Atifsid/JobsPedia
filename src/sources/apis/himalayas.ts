import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { himalayasConfig } from "../../config.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { sanitizeSalary } from "../common/salary.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import type { ApiProvider } from "./base.js";

interface HimalayasJob {
  title: string;
  companyName: string;
  minSalary: number | null;
  maxSalary: number | null;
  currency: string | null;
  locationRestrictions: string[] | null;
  description: string | null;
  pubDate: number | null;
  applicationLink: string;
}

interface HimalayasSearchResponse {
  jobs: HimalayasJob[];
}

function toJob(raw: HimalayasJob): NewJob {
  const { salaryMin, salaryMax } = sanitizeSalary(raw.minSalary, raw.maxSalary);
  const restrictions = raw.locationRestrictions ?? [];
  const country = restrictions.length === 1 ? restrictions[0] : null;
  return {
    id: jobId(raw.applicationLink),
    title: raw.title,
    company: raw.companyName,
    location: country,
    city: null,
    region: null,
    country,
    seniority: deriveSeniority(raw.title),
    isRemote: true,
    visaSponsorship: null,
    salaryMin,
    salaryMax,
    currency: raw.currency,
    applyUrl: raw.applicationLink,
    description: stripHtml(raw.description),
    datePosted: toIsoDate(raw.pubDate),
    platform: "himalayas",
    source: "aggregator",
  };
}

async function fetchTermPage(term: string, page: number): Promise<HimalayasSearchResponse> {
  return fetchJson<HimalayasSearchResponse>(
    `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(term)}&page=${page}`,
  );
}

export const himalayas: ApiProvider = {
  platform: "himalayas",
  async fetch(): Promise<NewJob[]> {
    const jobs: NewJob[] = [];
    for (const term of himalayasConfig.searchTerms) {
      for (let page = 1; page <= himalayasConfig.pagesPerTerm; page++) {
        const data = await fetchTermPage(term, page);
        if (data.jobs.length === 0) break;
        jobs.push(...mapSkipInvalid(data.jobs, toJob, "himalayas"));
      }
    }
    return jobs;
  },
};
