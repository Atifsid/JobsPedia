import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { remoteJobsOrgCategories } from "../../config.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { sanitizeSalary } from "../common/salary.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import { paginate, type PageResult } from "../common/pagination.js";
import type { ApiProvider } from "./base.js";

const PAGE_SIZE = 50;

interface RemoteJobsOrgJob {
  title: string;
  url: string;
  apply_url: string | null;
  company: { name: string };
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  posted_at: string | null;
}

interface RemoteJobsOrgResponse {
  data: RemoteJobsOrgJob[];
  pagination: { total: number };
}

function toJob(raw: RemoteJobsOrgJob): NewJob {
  const applyUrl = raw.apply_url || raw.url;
  const { salaryMin, salaryMax } = sanitizeSalary(raw.salary_min, raw.salary_max);
  return {
    id: jobId(applyUrl),
    title: raw.title,
    company: raw.company.name,
    location: raw.location,
    city: null,
    region: null,
    country: null,
    seniority: deriveSeniority(raw.title),
    isRemote: true,
    visaSponsorship: null,
    salaryMin,
    salaryMax,
    currency: null,
    applyUrl,
    description: stripHtml(raw.description),
    datePosted: toIsoDate(raw.posted_at),
    platform: "remotejobsorg",
    source: "aggregator",
  };
}

async function fetchPage(category: string, offset: number): Promise<PageResult<RemoteJobsOrgJob>> {
  const data = await fetchJson<RemoteJobsOrgResponse>(
    `https://remotejobs.org/api/v1/jobs?category=${encodeURIComponent(category)}&limit=${PAGE_SIZE}&offset=${offset}`,
  );
  return { items: data.data, total: data.pagination.total };
}

export const remotejobsorg: ApiProvider = {
  platform: "remotejobsorg",
  async fetch(): Promise<NewJob[]> {
    const jobs: NewJob[] = [];
    for (const category of remoteJobsOrgCategories) {
      const raw = await paginate((offset) => fetchPage(category, offset), PAGE_SIZE);
      jobs.push(...mapSkipInvalid(raw, toJob, "remotejobsorg"));
    }
    return jobs;
  },
};
