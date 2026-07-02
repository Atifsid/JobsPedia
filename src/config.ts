import type { Platform } from "./schema.js";

export interface AtsSeed {
  platform: Extract<Platform, "greenhouse" | "lever" | "ashby">;
  slug: string;
}

/**
 * Seed companies to crawl on each ATS platform. All slugs below were verified live
 * against their public JSON boards while building this project (each returned a
 * non-empty job list) — see README "Assumptions" for the verification method.
 */
export const atsSeeds: AtsSeed[] = [
  { platform: "greenhouse", slug: "stripe" },
  { platform: "greenhouse", slug: "airbnb" },
  { platform: "greenhouse", slug: "figma" },
  { platform: "greenhouse", slug: "cloudflare" },
  { platform: "lever", slug: "gohighlevel" },
  { platform: "lever", slug: "q-ctrl" },
  { platform: "lever", slug: "achievers" },
  { platform: "ashby", slug: "ramp" },
  { platform: "ashby", slug: "linear" },
  { platform: "ashby", slug: "notion" },
];

/** Search terms used to seed the (opt-in, off-by-default) aggregator crawl. */
export const aggregatorSearchTerms: string[] = [
  "software engineer",
  "product manager",
];

export const aggregatorConfig = {
  site_name: ["linkedin", "indeed", "glassdoor"] as const,
  location: "United States",
  resultsWanted: 15,
};
