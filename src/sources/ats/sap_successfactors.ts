import { XMLParser } from "fast-xml-parser";
import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchText } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

interface SapItem {
  title: string;
  description?: string | null;
  link: string;
  "g:employer"?: string | null;
  "g:location"?: string | null;
}

interface SapRss {
  rss?: { channel?: { item?: SapItem[] } };
}

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === "item",
});

function toJob(raw: SapItem): NewJob {
  if (!raw["g:employer"]) {
    throw new Error(`missing g:employer for item titled "${raw.title}"`);
  }
  const loc = parseLocation(raw["g:location"] ?? null);
  return {
    id: jobId(raw.link),
    title: raw.title,
    company: raw["g:employer"],
    location: loc.location,
    city: loc.city,
    region: loc.region,
    country: loc.country,
    seniority: deriveSeniority(raw.title),
    isRemote: loc.isRemote,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: raw.link,
    description: stripHtml(raw.description),
    datePosted: null,
    platform: "sap_successfactors",
    source: "ats",
  };
}

export const sapSuccessfactors: AtsScraper = {
  platform: "sap_successfactors",
  async fetch(rmkDomain: string): Promise<NewJob[]> {
    const xml = await fetchText(`https://${rmkDomain}/sitemal.xml`);
    const parsed = parser.parse(xml) as SapRss;
    const items = parsed.rss?.channel?.item ?? [];
    return mapSkipInvalid(items, toJob, "sap_successfactors");
  },
};
