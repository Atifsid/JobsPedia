import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { markStale, openDb, upsertJobs } from "../src/db.js";
import type { NewJob } from "../src/schema.js";

function job(overrides: Partial<NewJob>): NewJob {
  return {
    id: overrides.id ?? "job-1",
    title: "Software Engineer",
    company: "Acme",
    location: "Remote",
    city: null,
    region: null,
    country: null,
    seniority: "mid",
    isRemote: true,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
    description: null,
    datePosted: null,
    platform: "greenhouse",
    source: "ats",
    ...overrides,
  };
}

function isActive(db: Database.Database, id: string): boolean {
  const row = db.prepare("SELECT is_active FROM jobs WHERE id = ?").get(id) as { is_active: number };
  return row.is_active === 1;
}

describe("markStale", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(":memory:");
  });

  afterEach(() => db.close());

  it("with no platforms arg, marks all stale rows of the given source not in seenIds (unchanged prior behavior)", () => {
    upsertJobs(db, [
      job({ id: "ats-1", source: "ats", platform: "greenhouse" }),
      job({ id: "ats-2", source: "ats", platform: "lever" }),
      job({ id: "agg-1", source: "aggregator", platform: "linkedin", applyUrl: "https://linkedin.com/jobs/1" }),
    ]);

    markStale(db, ["ats-1"], "ats");

    expect(isActive(db, "ats-1")).toBe(true);
    expect(isActive(db, "ats-2")).toBe(false);
    // Different source entirely — untouched regardless of seenIds.
    expect(isActive(db, "agg-1")).toBe(true);
  });

  it("with a platforms arg, only touches rows whose platform is in that list", () => {
    upsertJobs(db, [
      job({ id: "remoteok-1", source: "aggregator", platform: "remoteok", applyUrl: "https://remoteok.com/1" }),
      job({ id: "remoteok-2", source: "aggregator", platform: "remoteok", applyUrl: "https://remoteok.com/2" }),
      job({ id: "linkedin-1", source: "aggregator", platform: "linkedin", applyUrl: "https://linkedin.com/1" }),
    ]);

    // Only remoteok-1 was "seen" this run, and only remoteok/remotive platforms were
    // crawled — linkedin-1 must survive even though its id isn't in seenIds, because
    // linkedin wasn't crawled this invocation.
    markStale(db, ["remoteok-1"], "aggregator", ["remoteok", "remotive"]);

    expect(isActive(db, "remoteok-1")).toBe(true);
    expect(isActive(db, "remoteok-2")).toBe(false);
    expect(isActive(db, "linkedin-1")).toBe(true);
  });

  it("with an empty seenIds and a platforms arg, marks all active rows of matching platforms stale", () => {
    upsertJobs(db, [
      job({ id: "remoteok-1", source: "aggregator", platform: "remoteok", applyUrl: "https://remoteok.com/1" }),
      job({ id: "linkedin-1", source: "aggregator", platform: "linkedin", applyUrl: "https://linkedin.com/1" }),
    ]);

    markStale(db, [], "aggregator", ["remoteok"]);

    expect(isActive(db, "remoteok-1")).toBe(false);
    expect(isActive(db, "linkedin-1")).toBe(true);
  });
});
