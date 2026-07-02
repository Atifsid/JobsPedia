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
    isRemote: false,
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
      job({ id: "1", title: "Senior Software Engineer", city: "Berlin", country: "DE", isRemote: false }),
      job({
        id: "2",
        title: "Product Manager",
        city: "Paris",
        country: "FR",
        isRemote: true,
        description: "Own the roadmap.",
        applyUrl: "https://boards.greenhouse.io/acme/jobs/2",
      }),
      job({
        id: "3",
        title: "Staff Software Engineer",
        company: "Beta",
        city: "Berlin",
        country: "DE",
        isRemote: true,
        source: "aggregator",
        platform: "linkedin",
        applyUrl: "https://linkedin.com/jobs/3",
      }),
    ]);
  });

  afterEach(() => db.close());

  it("returns the documented response shape", () => {
    const res = searchJobs(db, { page: 1, limit: 20 });
    expect(res).toMatchObject({ page: 1 });
    expect(res.count).toBe(res.jobs.length);
    expect(res.jobs.length).toBeGreaterThan(0);
  });

  it("full-text matches on title", () => {
    const res = searchJobs(db, { title: "engineer", page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id).sort()).toEqual(["1", "3"]);
  });

  it("filters by city and source together", () => {
    const res = searchJobs(db, { city: "Berlin", source: "ats", page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id)).toEqual(["1"]);
  });

  it("filters by remote", () => {
    const res = searchJobs(db, { remote: true, page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id).sort()).toEqual(["2", "3"]);
  });

  it("matches keywords against the description", () => {
    const res = searchJobs(db, { keywords: ["python", "aws"], page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id).sort()).toEqual(["1", "3"]);
  });

  it("excludes inactive jobs", () => {
    db.prepare("UPDATE jobs SET is_active = 0 WHERE id = ?").run("1");
    const res = searchJobs(db, { title: "engineer", page: 1, limit: 20 });
    expect(res.jobs.map((j) => j.id)).toEqual(["3"]);
  });
});
