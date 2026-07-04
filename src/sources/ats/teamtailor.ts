import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { toIsoDate } from "../common/date.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

const REMOTE_RE = /\bremote\b/i;

interface TeamtailorAddress {
  addressLocality?: string | null;
  addressCountry?: string | null;
}

interface TeamtailorJobPosting {
  hiringOrganization?: { name?: string | null };
  jobLocation?: { address?: TeamtailorAddress }[];
}

interface TeamtailorItem {
  title: string;
  url: string;
  date_published?: string | null;
  content_html?: string | null;
  _jobposting?: TeamtailorJobPosting;
}

interface TeamtailorFeed {
  items: TeamtailorItem[];
}

function toJob(raw: TeamtailorItem, tenant: string): NewJob {
  const address = raw._jobposting?.jobLocation?.[0]?.address;
  const city = address?.addressLocality ?? null;
  const country = address?.addressCountry ?? null;
  const isRemote = REMOTE_RE.test(raw.title) || REMOTE_RE.test(raw.content_html ?? "");
  return {
    id: jobId(raw.url),
    title: raw.title,
    company: raw._jobposting?.hiringOrganization?.name || humanizeSlug(tenant),
    location: [city, country].filter(Boolean).join(", ") || null,
    city,
    region: null,
    country,
    seniority: deriveSeniority(raw.title),
    isRemote,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: raw.url,
    description: stripHtml(raw.content_html),
    datePosted: toIsoDate(raw.date_published ?? null),
    platform: "teamtailor",
    source: "ats",
  };
}

export const teamtailor: AtsScraper = {
  platform: "teamtailor",
  async fetch(tenant: string): Promise<NewJob[]> {
    const feed = await fetchJson<TeamtailorFeed>(`https://${tenant}.teamtailor.com/jobs.json`);
    return mapSkipInvalid(feed.items, (item) => toJob(item, tenant), "teamtailor");
  },
};
