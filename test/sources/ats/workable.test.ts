import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workable } from "../../../src/sources/ats/workable.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/workable.json", import.meta.url)), "utf-8"),
);

describe("workable scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps an account's jobs into the canonical schema without hitting the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await workable.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://apply.workable.com/api/v1/widget/accounts/acme?details=true",
    );
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Inc",
      city: "San Francisco",
      region: "California",
      country: "United States",
      seniority: "senior",
      isRemote: true,
      platform: "workable",
      source: "ats",
      applyUrl: "https://apply.workable.com/acme/j/ABC123DEF4/apply",
    });
    expect(jobs[0].description).toBe("Build great things.");

    expect(jobs[1].isRemote).toBe(false);
    expect(jobs[1].city).toBe("London");
    expect(jobs[1].country).toBe("United Kingdom");
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(workable.fetch("missing-co")).rejects.toThrow(/404/);
  });
});
