import { z } from "zod";

export const sourceEnum = z.enum(["ats", "aggregator"]);
export type Source = z.infer<typeof sourceEnum>;

export const platformEnum = z.enum([
  "greenhouse",
  "lever",
  "ashby",
  "linkedin",
  "indeed",
  "glassdoor",
  "google",
  "google_careers",
  "zip_recruiter",
  "bayt",
  "naukri",
  "bdjobs",
]);
export type Platform = z.infer<typeof platformEnum>;

// Fields set by the crawl pipeline before a job is inserted into the DB.
// Individual source fetchers produce a NewJob (see below) and never set these.
export const jobSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  isRemote: z.boolean().default(false),
  salaryMin: z.number().int().positive().nullable(),
  salaryMax: z.number().int().positive().nullable(),
  currency: z.string().length(3).nullable(),
  applyUrl: z.url(),
  description: z.string().nullable(),
  datePosted: z.iso.datetime({ offset: true }).or(z.iso.date()).nullable(),
  platform: platformEnum,
  source: sourceEnum,
  firstSeen: z.iso.datetime({ offset: true }),
  lastSeen: z.iso.datetime({ offset: true }),
  isActive: z.boolean().default(true),
});
export type Job = z.infer<typeof jobSchema>;

// What a source fetcher (ATS scraper or the jobspy-js adapter) produces,
// before dedupe assigns first_seen/last_seen/is_active for the DB row.
export const newJobSchema = jobSchema.omit({
  firstSeen: true,
  lastSeen: true,
  isActive: true,
});
export type NewJob = z.infer<typeof newJobSchema>;
