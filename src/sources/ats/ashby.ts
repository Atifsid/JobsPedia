import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { sanitizeSalary } from "../common/salary.js";
import { humanizeSlug } from "../common/slug.js";
import { fetchJson, type AtsScraper } from "./base.js";

interface AshbyCompensationComponent {
  compensationType: string;
  minValue: number | null;
  maxValue: number | null;
  currencyCode?: string | null;
}

interface AshbyPosting {
  id: string;
  title: string;
  location: string | null;
  isRemote: boolean;
  publishedAt: string | null;
  jobUrl: string;
  applyUrl: string;
  descriptionPlain: string | null;
  descriptionHtml: string | null;
  address?: {
    postalAddress?: {
      addressLocality?: string | null;
      addressRegion?: string | null;
      addressCountry?: string | null;
    } | null;
  } | null;
  compensation?: {
    summaryComponents?: AshbyCompensationComponent[] | null;
  } | null;
}

interface AshbyBoard {
  jobs: AshbyPosting[];
}

function toJob(raw: AshbyPosting, slug: string): NewJob {
  const loc = parseLocation(raw.location);
  const postal = raw.address?.postalAddress ?? null;
  const salaryComponent = raw.compensation?.summaryComponents?.find(
    (c) => c.compensationType === "Salary",
  );
  const { salaryMin, salaryMax } = sanitizeSalary(
    salaryComponent?.minValue,
    salaryComponent?.maxValue,
  );
  return {
    id: jobId(raw.applyUrl || raw.jobUrl),
    title: raw.title,
    company: humanizeSlug(slug),
    location: loc.location,
    city: postal?.addressLocality ?? loc.city,
    region: postal?.addressRegion ?? loc.region,
    country: postal?.addressCountry ?? loc.country,
    seniority: deriveSeniority(raw.title),
    isRemote: raw.isRemote || loc.isRemote,
    salaryMin,
    salaryMax,
    currency: salaryComponent?.currencyCode ?? null,
    applyUrl: raw.applyUrl || raw.jobUrl,
    description: raw.descriptionPlain ? stripHtml(raw.descriptionPlain) : stripHtml(raw.descriptionHtml),
    datePosted: raw.publishedAt,
    platform: "ashby",
    source: "ats",
  };
}

export const ashby: AtsScraper = {
  platform: "ashby",
  async fetch(slug: string): Promise<NewJob[]> {
    const board = await fetchJson<AshbyBoard>(
      `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
    );
    return board.jobs.map((p) => toJob(p, slug));
  },
};
