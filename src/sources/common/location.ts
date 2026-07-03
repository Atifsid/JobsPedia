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
