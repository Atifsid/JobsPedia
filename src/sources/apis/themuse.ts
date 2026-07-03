import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { museConfig } from "../../config.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import type { ApiProvider } from "./base.js";

interface MusePosting {
  contents: string | null;
  name: string;
  publication_date: string | null;
  locations: { name: string }[];
  refs: { landing_page: string };
  company: { name: string };
}

interface MuseResponse {
  results: MusePosting[];
}

function toJob(raw: MusePosting): NewJob {
  const loc = parseLocation(raw.locations.map((l) => l.name).join("; ") || null);
  return {
    id: jobId(raw.refs.landing_page),
    title: raw.name,
    company: raw.company.name,
    location: loc.location,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    seniority: deriveSeniority(raw.name),
    isRemote: loc.isRemote,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: raw.refs.landing_page,
    description: stripHtml(raw.contents),
    datePosted: toIsoDate(raw.publication_date),
    platform: "themuse",
    source: "aggregator",
  };
}

async function fetchCategoryPage(category: string, page: number): Promise<MuseResponse> {
  return fetchJson<MuseResponse>(
    `https://www.themuse.com/api/public/jobs?page=${page}&category=${encodeURIComponent(category)}`,
  );
}

export const themuse: ApiProvider = {
  platform: "themuse",
  async fetch(): Promise<NewJob[]> {
    const jobs: NewJob[] = [];
    for (const category of museConfig.categories) {
      for (let page = 1; page <= museConfig.pagesPerCategory; page++) {
        const data = await fetchCategoryPage(category, page);
        if (data.results.length === 0) break;
        jobs.push(...mapSkipInvalid(data.results, toJob, "themuse"));
      }
    }
    return jobs;
  },
};
