import * as cheerio from "cheerio";
import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchText } from "../common/http.js";
import { parseLocation } from "../common/location.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

interface JobviteRow {
  title: string;
  path: string;
  locationText: string;
}

function parseRows(html: string): JobviteRow[] {
  const $ = cheerio.load(html);
  const rows: JobviteRow[] = [];
  $("table.jv-job-list tr").each((_, el) => {
    const link = $(el).find("td.jv-job-list-name a");
    const href = link.attr("href");
    const title = link.text().trim();
    if (!href || !title) return;
    const locationText = $(el)
      .find("td.jv-job-list-location")
      .text()
      .replace(/\s+/g, " ")
      .trim();
    rows.push({ title, path: href, locationText });
  });
  return rows;
}

function toJob(raw: JobviteRow, slug: string): NewJob {
  const loc = parseLocation(raw.locationText || null);
  const applyUrl = `https://jobs.jobvite.com${raw.path}`;
  return {
    id: jobId(applyUrl),
    title: raw.title,
    company: humanizeSlug(slug),
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
    applyUrl,
    description: null,
    datePosted: null,
    platform: "jobvite",
    source: "ats",
  };
}

export const jobvite: AtsScraper = {
  platform: "jobvite",
  async fetch(slug: string): Promise<NewJob[]> {
    const html = await fetchText(`https://jobs.jobvite.com/careers/${slug}/jobs`);
    const rows = parseRows(html);
    return mapSkipInvalid(rows, (r) => toJob(r, slug), "jobvite");
  },
};
