import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { toIsoDate } from "../common/date.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import { paginate, type PageResult } from "../common/pagination.js";
import { mapWithConcurrency } from "../common/concurrency.js";
import type { AtsScraper } from "./base.js";

const PAGE_SIZE = 10;
const DETAIL_CONCURRENCY = 5;

interface EightfoldPosition {
  id: number | string;
  name: string;
  location?: string | null;
  t_create?: number | null;
  canonicalPositionUrl: string;
  work_location_option?: string | null;
  job_description?: string | null;
}

interface EightfoldJobsPage {
  positions: EightfoldPosition[];
  count: number;
}

function parseSlug(slug: string): { tenant: string; domain: string } {
  const [tenant, domain] = slug.split(":");
  if (!tenant || !domain) {
    throw new Error(`eightfold slug must be "{tenant}:{domain}", got "${slug}"`);
  }
  return { tenant, domain };
}

function toJob(raw: EightfoldPosition, detail: EightfoldPosition | null, domain: string): NewJob {
  const loc = parseLocation(raw.location ?? null);
  const isRemote = raw.work_location_option?.toLowerCase() === "remote" || loc.isRemote;
  const companyName = humanizeSlug(domain.replace(/\.[a-z]+$/i, ""));
  return {
    id: jobId(raw.canonicalPositionUrl),
    title: raw.name,
    company: companyName,
    location: loc.location,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    seniority: deriveSeniority(raw.name),
    isRemote,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: raw.canonicalPositionUrl,
    description: stripHtml(detail?.job_description ?? raw.job_description ?? null),
    datePosted: toIsoDate(raw.t_create ?? null),
    platform: "eightfold",
    source: "ats",
  };
}

export const eightfold: AtsScraper = {
  platform: "eightfold",
  async fetch(slug: string): Promise<NewJob[]> {
    const { tenant, domain } = parseSlug(slug);
    const positions = await paginate<EightfoldPosition>(async (offset): Promise<PageResult<EightfoldPosition>> => {
      const data = await fetchJson<EightfoldJobsPage>(
        `https://${tenant}.eightfold.ai/api/apply/v2/jobs?domain=${encodeURIComponent(domain)}&hl=en&start=${offset}`,
      );
      return { items: data.positions, total: data.count };
    }, PAGE_SIZE);

    const details = await mapWithConcurrency(positions, DETAIL_CONCURRENCY, async (p) => {
      try {
        return await fetchJson<EightfoldPosition>(
          `https://${tenant}.eightfold.ai/api/apply/v2/jobs/${p.id}?domain=${encodeURIComponent(domain)}&hl=en`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[eightfold] failed to fetch detail for position ${p.id}: ${msg}`);
        return null;
      }
    });

    return mapSkipInvalid(
      positions.map((position, i) => ({ position, detail: details[i] })),
      ({ position, detail }) => toJob(position, detail, domain),
      "eightfold",
    );
  },
};
