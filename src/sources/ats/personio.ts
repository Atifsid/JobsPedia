import { XMLParser } from "fast-xml-parser";
import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchText } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { toIsoDate } from "../common/date.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

interface PersonioJobDescription {
  name: string;
  value: string;
}

interface PersonioPosition {
  id: string | number;
  office?: string | null;
  name: string;
  jobDescriptions?: { jobDescription?: PersonioJobDescription[] };
  createdAt?: string | null;
}

interface PersonioFeed {
  "workzag-jobs"?: { position?: PersonioPosition[] };
}

// Personio's feed collapses a single repeated element to a bare object instead of a
// one-item array, so <position> and <jobDescription> must be forced to always parse
// as arrays — otherwise a company with exactly one job (or one description block)
// breaks the mapper.
const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === "position" || name === "jobDescription",
});

function toJob(raw: PersonioPosition, slug: string): NewJob {
  const loc = parseLocation(raw.office ?? null);
  const applyUrl = `https://${slug}.jobs.personio.de/job/${raw.id}`;
  const descriptions = raw.jobDescriptions?.jobDescription ?? [];
  const description =
    descriptions.length > 0 ? stripHtml(descriptions.map((d) => d.value).join("\n\n")) : null;
  return {
    id: jobId(applyUrl),
    title: raw.name,
    company: humanizeSlug(slug),
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
    applyUrl,
    description,
    datePosted: toIsoDate(raw.createdAt ?? null),
    platform: "personio",
    source: "ats",
  };
}

export const personio: AtsScraper = {
  platform: "personio",
  async fetch(slug: string): Promise<NewJob[]> {
    const xml = await fetchText(`https://${slug}.jobs.personio.de/xml?language=en`);
    const parsed = parser.parse(xml) as PersonioFeed;
    const positions = parsed["workzag-jobs"]?.position ?? [];
    return mapSkipInvalid(positions, (p) => toJob(p, slug), "personio");
  },
};
