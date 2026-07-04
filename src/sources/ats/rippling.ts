import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import { paginate, type PageResult } from "../common/pagination.js";
import { mapWithConcurrency } from "../common/concurrency.js";
import type { AtsScraper } from "./base.js";

const PAGE_SIZE = 20;
const DETAIL_CONCURRENCY = 5;

interface RipplingLocation {
  name?: string | null;
  country?: string | null;
  countryCode?: string | null;
  workplaceType?: string | null;
}

interface RipplingJob {
  id: string;
  name: string;
  url: string;
  locations?: RipplingLocation[];
}

interface RipplingJobsPage {
  items: RipplingJob[];
  totalItems: number;
}

interface RipplingDetail {
  description?: { role?: string | null; company?: string | null };
}

function toJob(raw: RipplingJob, detail: RipplingDetail | null, slug: string): NewJob {
  const primary = raw.locations?.[0];
  const isRemote = primary?.workplaceType?.toUpperCase() === "REMOTE";
  const descriptionHtml = [detail?.description?.role, detail?.description?.company]
    .filter(Boolean)
    .join("\n\n");
  return {
    id: jobId(raw.url),
    title: raw.name,
    company: humanizeSlug(slug.replace(/-job-board$/, "")),
    location: primary?.name ?? null,
    city: null,
    region: null,
    country: primary?.countryCode ?? primary?.country ?? null,
    seniority: deriveSeniority(raw.name),
    isRemote,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: raw.url,
    description: descriptionHtml ? stripHtml(descriptionHtml) : null,
    datePosted: null,
    platform: "rippling",
    source: "ats",
  };
}

export const rippling: AtsScraper = {
  platform: "rippling",
  async fetch(slug: string): Promise<NewJob[]> {
    const jobs = await paginate<RipplingJob>(async (offset): Promise<PageResult<RipplingJob>> => {
      const page = Math.floor(offset / PAGE_SIZE) + 1;
      const data = await fetchJson<RipplingJobsPage>(
        `https://ats.rippling.com/api/v2/board/${slug}/jobs?page=${page}&pageSize=${PAGE_SIZE}`,
      );
      return { items: data.items, total: data.totalItems };
    }, PAGE_SIZE);

    const details = await mapWithConcurrency(jobs, DETAIL_CONCURRENCY, async (j) => {
      try {
        return await fetchJson<RipplingDetail>(`https://ats.rippling.com/api/v2/board/${slug}/jobs/${j.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[rippling] failed to fetch detail for job ${j.id}: ${msg}`);
        return null;
      }
    });

    return mapSkipInvalid(
      jobs.map((job, i) => ({ job, detail: details[i] })),
      ({ job, detail }) => toJob(job, detail, slug),
      "rippling",
    );
  },
};
