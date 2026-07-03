import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { sanitizeSalary } from "../common/salary.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import type { ApiProvider } from "./base.js";

interface RemoteOkJob {
  legal?: string;
  id?: string;
  company?: string;
  position?: string;
  description?: string | null;
  url?: string;
  apply_url?: string;
  date?: string | null;
  epoch?: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
}

function toJob(raw: RemoteOkJob): NewJob {
  const applyUrl = raw.apply_url || raw.url || "";
  const { salaryMin, salaryMax } = sanitizeSalary(raw.salary_min, raw.salary_max);
  return {
    id: jobId(applyUrl),
    title: raw.position ?? "",
    company: raw.company ?? "Unknown",
    location: null,
    city: null,
    region: null,
    country: null,
    seniority: deriveSeniority(raw.position ?? ""),
    isRemote: true,
    visaSponsorship: null,
    salaryMin,
    salaryMax,
    currency: null,
    applyUrl,
    description: stripHtml(raw.description),
    datePosted: toIsoDate(raw.date ?? raw.epoch ?? null),
    platform: "remoteok",
    source: "aggregator",
  };
}

export const remoteok: ApiProvider = {
  platform: "remoteok",
  async fetch(): Promise<NewJob[]> {
    const data = await fetchJson<RemoteOkJob[]>("https://remoteok.com/api");
    const jobs = data.filter((j) => !j.legal && j.id);
    return mapSkipInvalid(jobs, toJob, "remoteok");
  },
};
