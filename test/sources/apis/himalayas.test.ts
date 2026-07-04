import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { himalayas } from "../../../src/sources/apis/himalayas.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/himalayas.json", import.meta.url)), "utf-8"),
);

const emptyPage = { jobs: [] };

describe("himalayas provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps jobs into the canonical schema, paginating each search term and stopping on an empty page", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (new URL(url).searchParams.get("page") === "1") return { ok: true, json: async () => fixture };
      return { ok: true, json: async () => emptyPage };
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await himalayas.fetch();

    // 12 configured search terms x 2 pages each (page 1 with jobs, page 2 empty to break loop)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://himalayas.app/jobs/api/search?q=software%20engineer&page=1",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://himalayas.app/jobs/api/search?q=software%20engineer&page=2",
    );
    expect(fetchMock).toHaveBeenCalledTimes(24);
    expect(jobs).toHaveLength(24);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      country: "United States",
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
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(himalayas.fetch()).rejects.toThrow(/500/);
  });
});
