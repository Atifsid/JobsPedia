import type { NewJob, Platform } from "../../schema.js";

export interface AtsScraper {
  platform: Platform;
  /** Fetch all open jobs for one company's board, identified by its ATS slug. */
  fetch(slug: string): Promise<NewJob[]>;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} -> HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Strip HTML tags/entities down to plain, FTS-friendly text. */
function decodeEntitiesOnce(s: string): string {
  return s
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  // Some ATS boards (e.g. Greenhouse's `content` field) return HTML that's itself
  // entity-encoded ("&lt;h2&gt;..."), and some source content is entity-encoded twice
  // over ("&amp;amp;" for a literal "&"). Decode in a couple of bounded passes before
  // stripping tags — otherwise the tag-stripping regex runs first and finds no literal
  // "<" to match.
  let decoded = html;
  for (let i = 0; i < 2; i++) decoded = decodeEntitiesOnce(decoded);
  const text = decoded
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 0 ? text : null;
}

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

const REMOTE_RE = /\bremote\b/i;

export interface ParsedLocation {
  location: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  isRemote: boolean;
}

/**
 * Best-effort split of a free-text location string ("City, ST", "City, ST, Country",
 * "Remote - US", ...) into city/region/country. ATS boards don't expose these as
 * separate fields, so this is a heuristic, not a geocoder.
 */
export function parseLocation(raw: string | null | undefined): ParsedLocation {
  if (!raw || !raw.trim()) {
    return { location: null, city: null, region: null, country: null, isRemote: false };
  }
  const location = raw.trim();
  const isRemote = REMOTE_RE.test(location);
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  let city: string | null = null;
  let region: string | null = null;
  let country: string | null = null;

  if (parts.length >= 3) {
    [city, region, country] = parts;
  } else if (parts.length === 2) {
    const [first, second] = parts;
    if (US_STATE_CODES.has(second.toUpperCase())) {
      city = REMOTE_RE.test(first) ? null : first;
      region = second.toUpperCase();
      country = "US";
    } else {
      city = REMOTE_RE.test(first) ? null : first;
      country = second;
    }
  } else if (parts.length === 1) {
    if (!REMOTE_RE.test(parts[0])) city = parts[0];
  }

  return { location, city, region, country, isRemote };
}

/** Turn a URL slug into a display name when a platform doesn't expose one ("acme-corp" -> "Acme Corp"). */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Round to whole units and drop clearly-bad salary figures (e.g. hourly rates mistaken for annual). */
export function sanitizeSalary(
  min: number | null | undefined,
  max: number | null | undefined,
): { salaryMin: number | null; salaryMax: number | null } {
  const lo = typeof min === "number" && Number.isFinite(min) ? Math.round(min) : null;
  const hi = typeof max === "number" && Number.isFinite(max) ? Math.round(max) : null;
  const valid = (n: number | null) => n !== null && n >= 1000 && n <= 5_000_000;
  const salaryMin = valid(lo) ? lo : null;
  const salaryMax = valid(hi) ? hi : null;
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    return { salaryMin: salaryMax, salaryMax: salaryMin };
  }
  return { salaryMin, salaryMax };
}
