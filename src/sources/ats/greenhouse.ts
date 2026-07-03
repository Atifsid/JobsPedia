import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import type { AtsScraper } from "./base.js";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  company_name: string;
  location: { name: string | null } | null;
  content: string | null;
  first_published: string | null;
  updated_at: string | null;
}

interface GreenhouseBoard {
  jobs: GreenhouseJob[];
}

function toJob(raw: GreenhouseJob): NewJob {
  const loc = parseLocation(raw.location?.name ?? null);
  return {
    id: jobId(raw.absolute_url),
    title: raw.title,
    company: raw.company_name,
    location: loc.location,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    seniority: deriveSeniority(raw.title),
    isRemote: loc.isRemote,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: raw.absolute_url,
    description: stripHtml(raw.content),
    datePosted: raw.first_published ?? raw.updated_at ?? null,
    platform: "greenhouse",
    source: "ats",
  };
}

export const greenhouse: AtsScraper = {
  platform: "greenhouse",
  async fetch(slug: string): Promise<NewJob[]> {
    const board = await fetchJson<GreenhouseBoard>(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
    );
    return board.jobs.map(toJob);
  },
};
