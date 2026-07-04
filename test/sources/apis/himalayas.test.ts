import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { himalayas } from "../../../src/sources/apis/himalayas.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/himalayas.json", import.meta.url)), "utf-8"),
);

const emptyPage = { jobs: [] };

const page2 = {
  comments: "test fixture",
  updatedAt: 1783090385,
  offset: 0,
  limit: 20,
  totalCount: 1,
  jobs: [
    {
      title: "Senior Platform Engineer",
      excerpt: "Scale our platform.",
      companyName: "Acme Corp",
      companySlug: "acme-corp",
      companyLogo: "",
      employmentType: "Full Time",
      minSalary: 130000,
      maxSalary: 170000,
      salaryPeriod: "annual",
      seniority: ["Senior"],
      currency: "USD",
      locationRestrictions: ["United States"],
      timezoneRestrictions: [-8, -5],
      categories: ["Software-Engineering"],
      parentCategories: ["Developer"],
      description: "Scale our platform.",
      pubDate: 1780000100,
      expiryDate: 1787345953,
      applicationLink: "https://himalayas.app/companies/acme-corp/jobs/senior-platform-engineer",
      guid: "https://himalayas.app/companies/acme-corp/jobs/senior-platform-engineer",
    },
  ],
};

describe("himalayas provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps jobs into the canonical schema, paginating each search term and stopping on an empty page", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams;
      const q = params.get("q");
      const page = params.get("page");

      if (q === "software engineer" && page === "2") {
        return { ok: true, json: async () => page2 };
      }
      if (q === "software engineer" && page === "3") {
        return { ok: true, json: async () => emptyPage };
      }
      if (page === "1") {
        return { ok: true, json: async () => fixture };
      }
      return { ok: true, json: async () => emptyPage };
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await himalayas.fetch();

    // "software engineer" fetches pages 1, 2, 3 (3 calls, 3 jobs: 2 from page 1 + 1 from page 2)
    // 11 other terms fetch pages 1, 2 each (22 calls, 22 jobs: 2 per term)
    // Total: 25 calls, 25 jobs
    expect(fetchMock).toHaveBeenCalledWith(
      "https://himalayas.app/jobs/api/search?q=software%20engineer&page=1",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://himalayas.app/jobs/api/search?q=software%20engineer&page=2",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://himalayas.app/jobs/api/search?q=software%20engineer&page=3",
    );
    expect(fetchMock).toHaveBeenCalledTimes(25);
    expect(jobs).toHaveLength(25);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      country: "US",
      seniority: "senior",
      isRemote: true,
      salaryMin: 120000,
      salaryMax: 160000,
      currency: "USD",
      applyUrl: "https://himalayas.app/companies/acme-corp/jobs/senior-backend-engineer",
      platform: "himalayas",
      source: "aggregator",
      visaSponsorship: null,
    });
    expect(jobs[0].description).toBe("Build great things.");

    expect(jobs[1]).toMatchObject({
      title: "Support Engineer",
      country: null,
      salaryMin: null,
      currency: null,
    });

    const platformJob = jobs.find((j) => j.title === "Senior Platform Engineer");
    expect(platformJob).toBeDefined();
    expect(platformJob).toMatchObject({
      title: "Senior Platform Engineer",
      company: "Acme Corp",
      country: "US",
      seniority: "senior",
      isRemote: true,
      salaryMin: 130000,
      salaryMax: 170000,
      currency: "USD",
      applyUrl: "https://himalayas.app/companies/acme-corp/jobs/senior-platform-engineer",
      platform: "himalayas",
      source: "aggregator",
      visaSponsorship: null,
    });
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(himalayas.fetch()).rejects.toThrow(/500/);
  });
});
