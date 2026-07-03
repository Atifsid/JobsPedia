import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { sanitizeSalary } from "../common/salary.js";
import { toIsoDate } from "../common/date.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

interface RecruiteeSalary {
  min?: string | number | null;
  max?: string | number | null;
  currency?: string | null;
}

interface RecruiteeOffer {
  title: string;
  company_name: string;
  careers_url: string;
  remote?: boolean;
  city?: string | null;
  state_code?: string | null;
  country_code?: string | null;
  location?: string | null;
  description?: string | null;
  requirements?: string | null;
  salary?: RecruiteeSalary | null;
  published_at?: string | null;
  created_at?: string | null;
}

interface RecruiteeOffers {
  offers: RecruiteeOffer[];
}

function toJob(raw: RecruiteeOffer): NewJob {
  const locationText = raw.location ?? ([raw.city, raw.state_code, raw.country_code].filter(Boolean).join(", ") || null);
  const loc = parseLocation(locationText);
  const { salaryMin, salaryMax } = sanitizeSalary(
    raw.salary?.min != null ? Number(raw.salary.min) : null,
    raw.salary?.max != null ? Number(raw.salary.max) : null,
  );
  return {
    id: jobId(raw.careers_url),
    title: raw.title,
    company: raw.company_name,
    location: loc.location,
    city: raw.city ?? loc.city,
    region: raw.state_code ?? loc.region,
    country: raw.country_code ?? loc.country,
    seniority: deriveSeniority(raw.title),
    isRemote: Boolean(raw.remote) || loc.isRemote,
    salaryMin,
    salaryMax,
    currency: raw.salary?.currency ?? null,
    applyUrl: raw.careers_url,
    description: stripHtml([raw.description, raw.requirements].filter(Boolean).join("\n\n")),
    datePosted: toIsoDate(raw.published_at ?? raw.created_at ?? null),
    platform: "recruitee",
    source: "ats",
  };
}

export const recruitee: AtsScraper = {
  platform: "recruitee",
  async fetch(slug: string): Promise<NewJob[]> {
    const data = await fetchJson<RecruiteeOffers>(`https://${slug}.recruitee.com/api/offers/`);
    return mapSkipInvalid(data.offers, toJob, "recruitee");
  },
};
