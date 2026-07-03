import { describe, expect, it } from "vitest";
import { dedupeAndMerge } from "../src/dedupe.js";
import type { NewJob } from "../src/schema.js";

function job(overrides: Partial<NewJob>): NewJob {
  return {
    id: "id-1",
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

describe("dedupeAndMerge", () => {
  it("merges records sharing the same canonical-URL id, ATS-direct winning and filling gaps", () => {
    const atsJob = job({ id: "same-id", source: "ats", platform: "greenhouse" });
    const aggJob = job({
      id: "same-id",
      source: "aggregator",
      platform: "linkedin",
      salaryMin: 120000,
      salaryMax: 160000,
      currency: "USD",
      description: "Full JD here",
    });

    const result = dedupeAndMerge([aggJob, atsJob]);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("ats");
    expect(result[0].platform).toBe("greenhouse");
    expect(result[0].salaryMin).toBe(120000);
    expect(result[0].salaryMax).toBe(160000);
    expect(result[0].description).toBe("Full JD here");
  });

  it("never lets an aggregator record with the same id override a real ATS field", () => {
    const atsJob = job({ id: "same-id", source: "ats", salaryMin: 100000, salaryMax: 130000 });
    const aggJob = job({ id: "same-id", source: "aggregator", salaryMin: 999, salaryMax: 999 });

    const result = dedupeAndMerge([atsJob, aggJob]);

    expect(result[0].salaryMin).toBe(100000);
    expect(result[0].salaryMax).toBe(130000);
  });

  it("fuzzy-matches the same company + title + city across different apply URLs", () => {
    const atsJob = job({
      id: "ats-id",
      source: "ats",
      company: "Acme Corp",
      title: "Backend Engineer",
      city: "Berlin",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/2",
    });
    const aggJob = job({
      id: "agg-id",
      source: "aggregator",
      company: "acme corp",
      title: "backend engineer",
      city: "berlin",
      applyUrl: "https://www.linkedin.com/jobs/view/999",
      salaryMin: 90000,
    });

    const result = dedupeAndMerge([atsJob, aggJob]);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("ats");
    expect(result[0].salaryMin).toBe(90000);
  });

  it("keeps unrelated jobs separate", () => {
    const a = job({ id: "a", company: "Acme", title: "Engineer", city: "Berlin", applyUrl: "https://x.com/1" });
    const b = job({ id: "b", company: "Beta", title: "Designer", city: "Paris", applyUrl: "https://x.com/2" });

    const result = dedupeAndMerge([a, b]);

    expect(result).toHaveLength(2);
  });
});
