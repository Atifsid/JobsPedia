import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb, upsertJobs } from "../src/db.js";
import { searchJobs } from "../src/search.js";
import type { NewJob } from "../src/schema.js";

function job(overrides: Partial<NewJob>): NewJob {
  return {
    id: overrides.id ?? "job-1",
    title: "Software Engineer",
    company: "Acme",
    location: "Berlin, Germany",
    city: "Berlin",
    region: null,
    country: "DE",
    seniority: "mid",
    isRemote: false,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
    description: "We build backend systems with python and aws.",
    datePosted: "2026-06-01",
    platform: "greenhouse",
    source: "ats",
    ...overrides,
  };
}

describe("searchJobs", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(":memory:");
    upsertJobs(db, [
      job({ id: "1", title: "Senior Software Engineer", city: "Berlin", country: "DE", seniority: "senior", isRemote: false, salaryMin: 80000, salaryMax: 110000, datePosted: "2026-06-25" }),
      job({
        id: "2",
        // Title deliberately contains one of the two words the crossover test
        // searches for ("software") while the OTHER word ("developers") appears
        // only in the description below. This is what makes the regression test
        // meaningful: an unscoped (title+company+description) FTS match would
        // find both words somewhere in the combined document and incorrectly
        // match, while a title-scoped match correctly requires both words to
        // appear in jobs.title itself and correctly excludes this job.
        title: "Software Product Manager",
        city: "Paris",
        country: "FR",
        seniority: "mid",
        isRemote: true,
        description: "Own the roadmap. Work closely with developers to ship features.",
        applyUrl: "https://boards.greenhouse.io/acme/jobs/2",
        datePosted: "2026-06-20",
      }),
      job({
        id: "3",
        title: "Staff Software Engineer",
        company: "Beta",
        city: "Berlin",
        country: "DE",
        seniority: "staff",
        isRemote: true,
        source: "aggregator",
        platform: "linkedin",
        applyUrl: "https://linkedin.com/jobs/3",
        salaryMin: 140000,
        salaryMax: 180000,
        datePosted: "2026-01-01",
      }),
    ]);
  });

  afterEach(() => db.close());

  it("returns the documented response shape including total", () => {
    const res = searchJobs(db, { page: 1, limit: 20 });
    expect(res).toMatchObject({ page: 1 });
    expect(res.count).toBe(res.jobs.length);
    expect(res.total).toBe(3);
    expect(res.jobs.length).toBeGreaterThan(0);
  });

  it("title search matches only the title column, not description mentions", () => {
    // job 2's title ("Software Product Manager") contains "software" but NOT
    // "developers" — that word only appears in its description. A search for
    // both terms in the title must therefore find nothing.
    //
    // This is the actual crossover case the fix guards against: with the old
    // unscoped (title+company+description) FTS match, "software" (title) and
    // "developers" (description) would both be present somewhere in job 2's
    // combined document and the AND-of-terms query would incorrectly match it.
    // Title-scoping requires both words to appear in jobs.title itself, so job
    // 2 is correctly excluded.
    const res = searchJobs(db, { title: "Software Developers", page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id).sort()).toEqual([]);
  });

  it("title search matches jobs whose title actually contains the words", () => {
    const res = searchJobs(db, { title: "Software Engineer", page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id).sort()).toEqual(["1", "3"]);
  });

  it("keywords search still matches across title, company, and description", () => {
    const res = searchJobs(db, { keywords: ["python", "aws"], page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id).sort()).toEqual(["1", "3"]);
  });

  it("keywords search can surface the description-only developer mention", () => {
    const res = searchJobs(db, { keywords: ["developers"], page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id)).toEqual(["2"]);
  });

  it("filters by city and source together", () => {
    const res = searchJobs(db, { city: "Berlin", source: "ats", page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id)).toEqual(["1"]);
  });

  it("filters by remote", () => {
    const res = searchJobs(db, { remote: true, page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id).sort()).toEqual(["2", "3"]);
  });

  it("filters by visaSponsorship, excluding null/unknown when a value is requested", () => {
    upsertJobs(db, [
      job({ id: "visa-1", title: "Engineer A", company: "Acme", visaSponsorship: true }),
      job({ id: "visa-2", title: "Engineer B", company: "Beta", visaSponsorship: false }),
      job({ id: "visa-3", title: "Engineer C", company: "Gamma", visaSponsorship: null }),
    ]);

    const sponsorsOnly = searchJobs(db, { visaSponsorship: true, page: 1, limit: 20 });
    expect(sponsorsOnly.jobs.map((j) => j.id)).toEqual(["visa-1"]);

    const nonSponsorsOnly = searchJobs(db, { visaSponsorship: false, page: 1, limit: 20 });
    expect(nonSponsorsOnly.jobs.map((j) => j.id)).toEqual(["visa-2"]);
  });

  it("filters by seniority (exact match, multiple values)", () => {
    const res = searchJobs(db, { seniority: ["senior", "staff"], page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id).sort()).toEqual(["1", "3"]);
  });

  it("filters by company substring", () => {
    const res = searchJobs(db, { company: "beta", page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id)).toEqual(["3"]);
  });

  it("filters by minSalary, never excluding undisclosed salary", () => {
    const res = searchJobs(db, { minSalary: 150000, page: 1, limit: 20 });
    // job 3 (140k-180k) satisfies (max >= 150000); job 2 has no salary and
    // is never excluded; job 1 (80k-110k) fails the floor.
    expect(res.jobs.map((j) => j.id).sort()).toEqual(["2", "3"]);
  });

  it("filters by maxSalary, never excluding undisclosed salary", () => {
    const res = searchJobs(db, { maxSalary: 120000, page: 1, limit: 20 });
    // job 1 (80k-110k) satisfies (min <= 120000); job 2 has no salary and
    // is never excluded; job 3 (140k-180k) fails the ceiling.
    expect(res.jobs.map((j) => j.id).sort()).toEqual(["1", "2"]);
  });

  it("filters by daysAgo freshness", () => {
    const res = searchJobs(db, { daysAgo: 10, page: 1, limit: 20 });
    // "now" in this test run is long after 2026-06-25/06-20, so use a
    // reference far enough in the future relative to job 3's 2026-01-01
    // datePosted to exclude it deterministically regardless of today's date.
    expect(res.jobs.map((j) => j.id)).not.toContain("3");
  });

  it("excludes inactive jobs", () => {
    db.prepare("UPDATE jobs SET is_active = 0 WHERE id = ?").run("1");
    const res = searchJobs(db, { title: "Software Engineer", page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id)).toEqual(["3"]);
  });

  it("total reflects all matching rows, not just the current page", () => {
    const res = searchJobs(db, { seniority: ["senior", "staff", "mid"], page: 1, limit: 1 });
    expect(res.jobs.length).toBe(1);
    expect(res.total).toBe(3);
  });
});
