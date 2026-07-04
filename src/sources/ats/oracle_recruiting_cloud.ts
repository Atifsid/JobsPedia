import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { toIsoDate } from "../common/date.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import { paginate, type PageResult } from "../common/pagination.js";
import type { AtsScraper } from "./base.js";

const PAGE_SIZE = 50;

interface OrcWorkLocation {
  TownOrCity?: string | null;
  Country?: string | null;
  Region2?: string | null;
}

interface OrcRequisition {
  Id: string | number;
  Title: string;
  PostedDate?: string | null;
  PrimaryLocation?: string | null;
  PrimaryLocationCountry?: string | null;
  ShortDescriptionStr?: string | null;
  WorkplaceType?: string | null;
  workLocation?: OrcWorkLocation[];
}

interface OrcSearchResult {
  requisitionList: OrcRequisition[];
  TotalJobsCount: number;
}

interface OrcResponse {
  items: OrcSearchResult[];
}

function parseSlug(slug: string): { host: string; siteNumber: string } {
  const [host, siteNumber] = slug.split(":");
  if (!host || !siteNumber) {
    throw new Error(`oracle_recruiting_cloud slug must be "{host}:{siteNumber}", got "${slug}"`);
  }
  return { host, siteNumber };
}

function toJob(raw: OrcRequisition, host: string, siteNumber: string): NewJob {
  const workLoc = raw.workLocation?.[0];
  const city = workLoc?.TownOrCity ?? null;
  const country = workLoc?.Country ?? raw.PrimaryLocationCountry ?? null;
  const region = workLoc?.Region2 ?? null;
  const applyUrl = `https://${host}/hcmUI/CandidateExperience/en/sites/${siteNumber}/job/${raw.Id}`;
  return {
    id: jobId(applyUrl),
    title: raw.Title,
    company: humanizeSlug(host.split(".")[0]),
    location: raw.PrimaryLocation ?? city,
    city,
    region,
    country,
    seniority: deriveSeniority(raw.Title),
    isRemote: raw.WorkplaceType?.toLowerCase() === "remote",
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl,
    description: stripHtml(raw.ShortDescriptionStr),
    datePosted: toIsoDate(raw.PostedDate ?? null),
    platform: "oracle_recruiting_cloud",
    source: "ats",
  };
}

export const oracleRecruitingCloud: AtsScraper = {
  platform: "oracle_recruiting_cloud",
  async fetch(slug: string): Promise<NewJob[]> {
    const { host, siteNumber } = parseSlug(slug);
    const requisitions = await paginate<OrcRequisition>(async (offset): Promise<PageResult<OrcRequisition>> => {
      const url =
        `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true` +
        `&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations` +
        `&finder=findReqs;siteNumber=${siteNumber},limit=${PAGE_SIZE},offset=${offset}`;
      const data = await fetchJson<OrcResponse>(url);
      const result = data.items[0];
      return { items: result?.requisitionList ?? [], total: result?.TotalJobsCount ?? 0 };
    }, PAGE_SIZE);

    return mapSkipInvalid(requisitions, (r) => toJob(r, host, siteNumber), "oracle_recruiting_cloud");
  },
};
