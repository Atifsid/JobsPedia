import { loadAllSeeds } from "./seeds/store.js";

export type { AtsSeed, AtsSeedEntry } from "./seeds/store.js";

/** Seed companies to crawl on each ATS platform, loaded from `src/seeds/<platform>.json`. */
export const atsSeeds = loadAllSeeds();

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

/**
 * The Muse: `category` is a coarse, self-reported-by-employers taxonomy (confirmed live —
 * `category=Software Engineering` alone returns 100K+ of 400K+ total jobs), not a precise
 * filter. Bounded pages per category keep local data volume modest; call count itself is
 * cheap (The Muse allows 500 req/hour unauthenticated, 3600/hour with a free key).
 */
export const museConfig = {
  categories: ["Software Engineering", "Data and Analytics"],
  pagesPerCategory: 5,
};

/**
 * RemoteJobs.org: small total volume (~1,000 jobs at time of writing) and "reasonable use,
 * no hard cap" per their docs — one category is enough to cover the whole relevant board,
 * fully paginated each crawl (see remotejobsorg.ts's use of paginate()).
 */
export const remoteJobsOrgCategories: string[] = ["programming"];

/**
 * Himalayas: has a dedicated keyword-search endpoint (`/jobs/api/search?q=...`), confirmed
 * live to narrow results meaningfully (e.g. "software engineer" -> 231 of 100K+ total).
 * Rate-limited (no exact number published) and data is cached every 24h per their docs, so
 * bounded pages per term matches that cadence rather than exhaustively paginating.
 */
export const himalayasConfig = {
  searchTerms: [
    "software engineer",
    "backend engineer",
    "frontend engineer",
    "full stack engineer",
    "devops engineer",
    "data engineer",
    "mobile engineer",
    "site reliability engineer",
    "machine learning engineer",
    "engineering manager",
    "product engineer",
    "platform engineer",
  ],
  pagesPerTerm: 3,
};

/**
 * Adzuna: free tier is hard-capped at 25/min, 250/day, 1000/week, 2500/month (confirmed via
 * their published terms of service) — the one real constraint among these 4 sources. This
 * term x country list (10 x 2 = 20 calls/crawl) stays comfortably under the daily cap, leaving
 * headroom for retries or more than one crawl per day.
 */
export const adzunaConfig = {
  searchTerms: [
    "software engineer",
    "backend engineer",
    "frontend engineer",
    "full stack engineer",
    "devops engineer",
    "data engineer",
    "mobile engineer",
    "site reliability engineer",
    "machine learning engineer",
    "engineering manager",
  ],
  countries: ["us", "gb"] as const,
  resultsPerPage: 50,
};
