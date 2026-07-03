import type { NewJob } from "../../schema.js";
import { jobId } from "../../lib/id.js";
import { deriveSeniority } from "../../seniority.js";
import { fetchJson } from "../common/http.js";
import { stripHtml } from "../common/html.js";
import { parseLocation } from "../common/location.js";
import { toIsoDate } from "../common/date.js";
import { humanizeSlug } from "../common/slug.js";
import { mapSkipInvalid } from "../common/records.js";
import type { AtsScraper } from "./base.js";

interface ComeetLocation {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  is_remote?: boolean;
}

interface ComeetDetail {
  name: string;
  value: string;
  order: number;
}

interface ComeetPosition {
  uid: string;
  name: string;
  url_comeet_hosted_page: string;
  // Live probing showed this comes back as an ISO 8601 string, not the unix
  // timestamp the docs implied; toIsoDate() accepts either.
  time_updated?: string | number | null;
  company_name?: string | null;
  workplace_type?: string | null;
  location?: ComeetLocation | null;
  details?: ComeetDetail[] | null;
}

function toJob(raw: ComeetPosition, companyUid: string): NewJob {
  const locationText =
    raw.location?.name ??
    ([raw.location?.city, raw.location?.state, raw.location?.country].filter(Boolean).join(", ") || null);
  const loc = parseLocation(locationText);
  const details = [...(raw.details ?? [])].sort((a, b) => a.order - b.order);
  const description = details.length > 0 ? stripHtml(details.map((d) => d.value).join("\n\n")) : null;
  return {
    id: jobId(raw.url_comeet_hosted_page),
    title: raw.name,
    company: raw.company_name || humanizeSlug(companyUid),
    location: loc.location,
    city: raw.location?.city ?? loc.city,
    region: raw.location?.state ?? loc.region,
    country: raw.location?.country ?? loc.country,
    seniority: deriveSeniority(raw.name),
    isRemote: raw.location?.is_remote === true || raw.workplace_type?.toLowerCase() === "remote" || loc.isRemote,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: raw.url_comeet_hosted_page,
    description,
    datePosted: toIsoDate(raw.time_updated ?? null),
    platform: "comeet",
    source: "ats",
  };
}

/**
 * Comeet's public "list positions" endpoint (`GET /careers-api/2.0/company/{company_uid}/positions`)
 * returns a bare JSON array of positions (not `{ "positions": [...] }` as the docs'
 * example implies) and 400s with `{"message":"Token is missing"}` unless a
 * per-company API token is passed as a `?token=` query param. Both the numeric
 * `company_uid` (NOT the human-readable slug shown in `comeet.com/jobs/{slug}/...`
 * hosted URLs) and the token are embedded in every Comeet-hosted careers page's
 * initial state (`window.COMPANY_DATA.company_uid` / `.token`) — there is no public
 * way to derive the token from the slug alone. We encode both in the seed slug as
 * "<company_uid>:<token>".
 */
export const comeet: AtsScraper = {
  platform: "comeet",
  async fetch(companyIdentifier: string): Promise<NewJob[]> {
    const [companyUid, token] = companyIdentifier.split(":");
    const url = token
      ? `https://www.comeet.co/careers-api/2.0/company/${companyUid}/positions?token=${token}`
      : `https://www.comeet.co/careers-api/2.0/company/${companyUid}/positions`;
    const data = await fetchJson<ComeetPosition[]>(url);
    return mapSkipInvalid(data, (p) => toJob(p, companyUid), "comeet");
  },
};
