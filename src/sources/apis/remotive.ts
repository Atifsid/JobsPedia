import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import type { ApiProvider } from "./base.js";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  publication_date?: string | null;
  description?: string | null;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

function toJob(raw: RemotiveJob): NewJob {
  return {
    id: jobId(raw.url),
    title: raw.title,
    company: raw.company_name,
    location: null,
    city: null,
    region: null,
    country: null,
    seniority: deriveSeniority(raw.title),
    isRemote: true,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: raw.url,
    description: stripHtml(raw.description),
    datePosted: toIsoDate(raw.publication_date ?? null),
    platform: "remotive",
    source: "aggregator",
  };
}

export const remotive: ApiProvider = {
  platform: "remotive",
  async fetch(): Promise<NewJob[]> {
    const data = await fetchJson<RemotiveResponse>("https://remotive.com/api/remote-jobs");
    return mapSkipInvalid(data.jobs, toJob, "remotive");
  },
};
