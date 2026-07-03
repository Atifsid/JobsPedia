import type { Platform } from "./schema.js";

export interface AtsSeed {
  platform: Extract<
    Platform,
    | "greenhouse"
    | "lever"
    | "ashby"
    | "smartrecruiters"
    | "workable"
    | "recruitee"
    | "comeet"
    | "breezyhr"
    | "jobscore"
    | "personio"
    | "bamboohr"
  >;
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
  { platform: "workable", slug: "jobrack" },
  { platform: "breezyhr", slug: "new-incentives" },
  { platform: "jobscore", slug: "jobscore" },
  { platform: "personio", slug: "personio" },
  { platform: "recruitee", slug: "jobs" },
  { platform: "smartrecruiters", slug: "visa" },
  // Comeet's list-positions endpoint requires a per-company token in addition to the
  // company_uid (its 400 response otherwise reads "Token is missing") — both values
  // are embedded in the public HTML of the company's Comeet-hosted careers page, so
  // this is not a private credential. Encoded here as "<company_uid>:<token>"; see
  // src/sources/ats/comeet.ts for details.
  { platform: "comeet", slug: "61.003:16358C6EF2C61631639B558C0429" },
  { platform: "bamboohr", slug: "soundstripe" },
];

/** Search terms used to seed the (opt-in, off-by-default) aggregator crawl. */
export const aggregatorSearchTerms: string[] = [
  // General Software
  "software engineer",
  "software developer",
  "application developer",
  "programmer",

  // Full Stack
  "full stack engineer",
  "full stack developer",
  "fullstack engineer",
  "fullstack developer",

  // Frontend
  "frontend engineer",
  "frontend developer",
  "front end engineer",
  "front end developer",
  "react developer",
  "react.js developer",
  "react engineer",
  "next.js developer",
  "nextjs developer",
  "javascript developer",
  "typescript developer",
  "ui engineer",
  "web developer",

  // Mobile
  "mobile developer",
  "mobile engineer",
  "react native developer",
  "react native engineer",
  "react native mobile developer",
  "android developer",
  "android engineer",
  "ios developer",
  "cross platform developer",
  "cross-platform developer",

  // Backend
  "backend developer",
  "backend engineer",
  "back end developer",
  "back end engineer",
  "node.js developer",
  "nodejs developer",
  "node developer",
  "express developer",
  "hono developer",
  ".net developer",
  "dotnet developer",
  "asp.net developer",
  "c# developer",
  "spring boot developer",
  "java developer",
  "api developer",
  "rest api developer",

  // Cloud & DevOps (adjacent)
  "cloud engineer",
  "aws developer",

  // Seniority
  "senior software engineer",
  "senior software developer",
  "senior full stack engineer",
  "senior full stack developer",
  "senior frontend engineer",
  "senior frontend developer",
  "senior backend engineer",
  "senior backend developer",
  "senior react developer",
  "senior react native developer",
  "lead software engineer",
  "lead software developer",
  "technical lead",

  // Startup titles
  "founding engineer",
  "founding software engineer",
  "founding full stack engineer",

  // Common alternatives
  "software engineer ii",
  "software engineer 2",
  "sde",
  "sde 2",
  "sde ii",
  "member of technical staff",
  "mts",
  "application engineer",
  "product engineer"
];

export const aggregatorConfig = {
  site_name: ["linkedin", "indeed", "glassdoor"] as const,
  location: "United States",
  resultsWanted: 15,
};
