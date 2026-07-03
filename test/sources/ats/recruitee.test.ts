import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recruitee } from "../../../src/sources/ats/recruitee.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/recruitee.json", import.meta.url)), "utf-8"),
);

describe("recruitee scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a company's offers into the canonical schema without hitting the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await recruitee.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith("https://acme.recruitee.com/api/offers/");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      city: "Amsterdam",
      country: "NL",
      seniority: "senior",
      isRemote: false,
      salaryMin: 60000,
      salaryMax: 80000,
      currency: "EUR",
      platform: "recruitee",
      source: "ats",
      applyUrl: "https://acme.recruitee.com/o/senior-backend-engineer",
    });
    expect(jobs[0].description).toContain("Build great things.");
    expect(jobs[0].description).toContain("5+ years experience.");

    expect(jobs[1].isRemote).toBe(true);
    expect(jobs[1].salaryMin).toBeNull();
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(recruitee.fetch("missing-co")).rejects.toThrow(/404/);
  });
});
