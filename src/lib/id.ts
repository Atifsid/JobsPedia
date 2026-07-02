import { createHash } from "node:crypto";

// Query params that only carry attribution/tracking noise, never job identity.
// Some ATS embeds (e.g. Greenhouse links like stripe.com/jobs/search?gh_jid=123)
// encode the job id itself in the query string, so we can't strip it wholesale —
// only drop the known-tracking keys and keep everything else.
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "lever-source", "lever-origin", "gh_src", "trk", "ref", "source", "src",
]);

/**
 * Canonicalize an apply URL so the same posting (ATS-direct or reposted via an
 * aggregator) hashes to the same id: strips scheme, fragment, trailing slash,
 * and tracking query params, and lowercases the host.
 */
export function canonicalizeUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  const params = new URLSearchParams(u.search);
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) params.delete(key);
  }
  params.sort();
  const query = params.toString();
  return query ? `${host}${path}?${query}` : `${host}${path}`;
}

/** The dedup key: a stable hash of the canonical apply URL. */
export function jobId(applyUrl: string): string {
  return createHash("sha1").update(canonicalizeUrl(applyUrl)).digest("hex");
}
