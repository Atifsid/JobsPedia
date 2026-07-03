import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { smartrecruiters } from "../../../src/sources/ats/smartrecruiters.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/smartrecruiters.json", import.meta.url)), "utf-8"),
);

describe("smartrecruiters scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("paginates the postings list, fetches per-posting detail, and maps into the canonical schema", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/postings?")) return { ok: true, json: async () => fixture.postings };
      if (url.endsWith("/postings/posting-1")) return { ok: true, json: async () => fixture.details["posting-1"] };
      if (url.endsWith("/postings/posting-2")) return { ok: true, json: async () => fixture.details["posting-2"] };
      throw new Error(`unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await smartrecruiters.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.smartrecruiters.com/v1/companies/acme/postings?limit=100&offset=0",
    );
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      city: "Austin",
      region: "TX",
      country: "US",
      seniority: "senior",
      isRemote: false,
      platform: "smartrecruiters",
      source: "ats",
      applyUrl: "https://jobs.smartrecruiters.com/acme/posting-1",
    });
    expect(jobs[0].description).toContain("Build great things.");
    expect(jobs[0].description).toContain("5+ years experience.");

    expect(jobs[1].isRemote).toBe(true);
  });

  it("throws on a non-OK response from the list call so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(smartrecruiters.fetch("missing-co")).rejects.toThrow(/404/);
  });
});
