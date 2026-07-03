import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import {
  fetchJson,
  humanizeSlug,
  parseLocation,
  sanitizeSalary,
  stripHtml,
  type AtsScraper,
} from "./base.js";

interface LeverSalaryRange {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
}

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  country: string | null;
  workplaceType: string | null;
  createdAt: number | null;
  descriptionPlain: string | null;
  categories: {
    location?: string | null;
    team?: string | null;
    department?: string | null;
  };
  salaryRange?: LeverSalaryRange | null;
}

function toJob(raw: LeverPosting, slug: string): NewJob {
  const loc = parseLocation(raw.categories?.location ?? raw.country ?? null);
  const isRemote = loc.isRemote || raw.workplaceType?.toLowerCase() === "remote";
  const { salaryMin, salaryMax } = sanitizeSalary(raw.salaryRange?.min, raw.salaryRange?.max);
  return {
    id: jobId(raw.hostedUrl),
    title: raw.text,
    company: humanizeSlug(slug),
    location: loc.location,
    city: loc.city,
    region: loc.region,
    country: loc.country ?? raw.country ?? null,
    seniority: deriveSeniority(raw.text),
    isRemote,
    salaryMin,
    salaryMax,
    currency: raw.salaryRange?.currency ?? null,
    applyUrl: raw.hostedUrl,
    description: stripHtml(raw.descriptionPlain),
    datePosted: raw.createdAt ? new Date(raw.createdAt).toISOString() : null,
    platform: "lever",
    source: "ats",
  };
}

export const lever: AtsScraper = {
  platform: "lever",
  async fetch(slug: string): Promise<NewJob[]> {
    const postings = await fetchJson<LeverPosting[]>(
      `https://api.lever.co/v0/postings/${slug}?mode=json`,
    );
    return postings.map((p) => toJob(p, slug));
  },
};
