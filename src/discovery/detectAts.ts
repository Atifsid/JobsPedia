import { fetchText } from "../sources/common/http.js";
import type { Platform } from "../schema.js";

export interface AtsMatch {
  platform: Platform;
  slug: string;
}

/**
 * Hand-maintained per-platform career-page URL patterns (project convention: small,
 * explicit, copy-pasteable code over a generated/derived table). Greenhouse, lever,
 * ashby, teamtailor, pinpoint, rippling, and jobvite were live-verified against real
 * companies during R&D — the rest follow each platform's own known public-board host
 * convention (matching the host each `AtsScraper` already fetches from) and should be
 * spot-checked against a handful of real companies during rollout. `comeet` is
 * deliberately excluded: its `fetch()` needs a per-company token that isn't derivable
 * from a career-page URL alone (see `src/sources/ats/comeet.ts`).
 */
const ATS_DOMAIN_PATTERNS: { platform: Platform; pattern: RegExp }[] = [
  // Checked before the generic pattern below: Greenhouse's embeddable JS widget snippet
  // (`<script src=".../embed/job_board/js?for=acme">`) puts the real slug in a `for=` query
  // param — the generic pattern would otherwise capture the literal path segment "embed".
  { platform: "greenhouse", pattern: /boards\.greenhouse\.io\/embed\/job_board\/js\?for=([a-z0-9-]+)/i },
  { platform: "greenhouse", pattern: /(?:job-)?boards\.greenhouse\.io\/(?!embed(?:\/|\?|$))([a-z0-9-]+)/i },
  { platform: "lever", pattern: /jobs\.lever\.co\/([a-z0-9-]+)/i },
  { platform: "ashby", pattern: /jobs\.ashbyhq\.com\/([a-z0-9-]+)/i },
  { platform: "workable", pattern: /apply\.workable\.com\/([a-z0-9-]+)/i },
  { platform: "breezyhr", pattern: /([a-z0-9-]+)\.breezy\.hr/i },
  { platform: "jobscore", pattern: /(?:jobs|careers)\.jobscore\.com\/([a-z0-9-]+)/i },
  { platform: "personio", pattern: /([a-z0-9-]+)\.(?:jobs\.)?personio\.(?:de|com)/i },
  { platform: "recruitee", pattern: /([a-z0-9-]+)\.recruitee\.com/i },
  { platform: "smartrecruiters", pattern: /jobs\.smartrecruiters\.com\/([a-z0-9-]+)/i },
  { platform: "bamboohr", pattern: /([a-z0-9-]+)\.bamboohr\.com/i },
  { platform: "teamtailor", pattern: /([a-z0-9-]+)\.teamtailor\.com/i },
  { platform: "pinpoint", pattern: /([a-z0-9-]+)\.pinpointhq\.com/i },
  { platform: "rippling", pattern: /ats\.rippling\.com\/([a-z0-9-]+)/i },
  { platform: "jobvite", pattern: /jobs\.jobvite\.com\/careers\/([a-z0-9-]+)/i },
];

/** Bounded, ordered candidate paths — stop at the first one that yields a match. */
const CANDIDATE_PATHS = ["/careers", "/jobs", ""];

function normalizeWebsite(website: string): string {
  const withScheme = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  return withScheme.replace(/\/+$/, "");
}

/** Probe a company's likely career-page paths and match the HTML against known ATS domains. */
export async function detectAts(website: string): Promise<AtsMatch | null> {
  const base = normalizeWebsite(website);
  for (const path of CANDIDATE_PATHS) {
    let html: string;
    try {
      html = await fetchText(`${base}${path}`);
    } catch {
      continue; // path missing or site unreachable — try the next candidate
    }
    for (const { platform, pattern } of ATS_DOMAIN_PATTERNS) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return { platform, slug: match[1].toLowerCase() };
      }
    }
  }
  return null;
}
