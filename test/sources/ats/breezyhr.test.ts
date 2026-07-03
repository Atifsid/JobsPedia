import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { breezyhr } from "../../../src/sources/ats/breezyhr.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/breezyhr.json", import.meta.url)), "utf-8"),
);

describe("breezyhr scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a company's jobs into the canonical schema without hitting the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await breezyhr.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith("https://acme.breezy.hr/json");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Backend Engineer",
      company: "Acme Corp",
      city: "Austin",
      region: "TX",
      country: "US",
      seniority: "mid",
      isRemote: false,
      platform: "breezyhr",
      source: "ats",
      applyUrl: "https://acme.breezy.hr/p/b8e6b722f7ed-backend-engineer",
    });
    expect(jobs[0].description).toBe("Build great things.");

    expect(jobs[1].isRemote).toBe(true);
    expect(jobs[1].city).toBeNull();
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(breezyhr.fetch("missing-co")).rejects.toThrow(/404/);
  });
});
