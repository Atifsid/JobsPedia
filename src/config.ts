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
