import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import { paginate, type PageResult } from "../common/pagination.js";
import { mapWithConcurrency } from "../common/concurrency.js";
import type { AtsScraper } from "./base.js";

interface SmartRecruitersLocation {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  remote?: boolean;
  fullLocation?: string | null;
}

interface SmartRecruitersPosting {
  id: string;
  name: string;
  company: { identifier: string; name?: string | null };
  releasedDate?: string | null;
  location?: SmartRecruitersLocation | null;
}

interface SmartRecruitersPostingsPage {
  totalFound: number;
  content: SmartRecruitersPosting[];
}

interface SmartRecruitersDetail {
  jobAd?: {
    sections?: {
      jobDescription?: { text?: string | null };
      qualifications?: { text?: string | null };
      additionalInformation?: { text?: string | null };
    };
  };
}

const PAGE_SIZE = 100;
const DETAIL_CONCURRENCY = 5;

function toJob(raw: SmartRecruitersPosting, detail: SmartRecruitersDetail | null): NewJob {
  const rawLoc = raw.location;
  const locationText =
    rawLoc?.fullLocation ?? ([rawLoc?.city, rawLoc?.region, rawLoc?.country].filter(Boolean).join(", ") || null);
  const loc = parseLocation(locationText);
  const applyUrl = `https://jobs.smartrecruiters.com/${raw.company.identifier}/${raw.id}`;
  const sections = detail?.jobAd?.sections;
  const description = sections
    ? stripHtml(
        [sections.jobDescription?.text, sections.qualifications?.text, sections.additionalInformation?.text]
          .filter(Boolean)
          .join("\n\n"),
      )
    : null;
  return {
    id: jobId(applyUrl),
    title: raw.name,
    company: raw.company?.name || raw.company.identifier,
    location: loc.location,
    city: rawLoc?.city ?? loc.city,
    region: rawLoc?.region ?? loc.region,
    country: rawLoc?.country ? rawLoc.country.toUpperCase() : loc.country,
    seniority: deriveSeniority(raw.name),
    isRemote: rawLoc?.remote === true || loc.isRemote,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl,
    description,
    datePosted: toIsoDate(raw.releasedDate ?? null),
    platform: "smartrecruiters",
    source: "ats",
  };
}

export const smartrecruiters: AtsScraper = {
  platform: "smartrecruiters",
  async fetch(slug: string): Promise<NewJob[]> {
    const postings = await paginate<SmartRecruitersPosting>(async (offset): Promise<PageResult<SmartRecruitersPosting>> => {
      const page = await fetchJson<SmartRecruitersPostingsPage>(
        `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      return { items: page.content, total: page.totalFound };
    }, PAGE_SIZE);

    const details = await mapWithConcurrency(postings, DETAIL_CONCURRENCY, async (p) => {
      try {
        return await fetchJson<SmartRecruitersDetail>(
          `https://api.smartrecruiters.com/v1/companies/${slug}/postings/${p.id}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[smartrecruiters] failed to fetch detail for posting ${p.id}: ${msg}`);
        return null;
      }
    });

    return mapSkipInvalid(
      postings.map((posting, i) => ({ posting, detail: details[i] })),
      ({ posting, detail }) => toJob(posting, detail),
      "smartrecruiters",
    );
  },
};
