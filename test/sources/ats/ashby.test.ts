import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ashby } from "../../../src/sources/ats/ashby.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/ashby.json", import.meta.url)), "utf-8"),
);

describe("ashby scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps postings into the canonical schema, preferring structured address/compensation fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => fixture })));

    const jobs = await ashby.fetch("acme");

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: "Staff Software Engineer",
      company: "Acme",
      city: "New York City",
      region: "NY",
      country: "USA",
      seniority: "staff",
      isRemote: false,
      salaryMin: 200000,
      salaryMax: 260000,
      currency: "USD",
      platform: "ashby",
      source: "ats",
      applyUrl: "https://jobs.ashbyhq.com/acme/job-1/application",
    });

    expect(jobs[1]).toMatchObject({
      title: "Recruiting Coordinator",
      seniority: "mid",
      isRemote: true,
      salaryMin: null,
      salaryMax: null,
    });
  });
});
