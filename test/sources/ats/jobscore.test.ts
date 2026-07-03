import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jobscore } from "../../../src/sources/ats/jobscore.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/jobscore.json", import.meta.url)), "utf-8"),
);

describe("jobscore scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a company's jobs into the canonical schema without hitting the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await jobscore.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith("https://careers.jobscore.com/jobs/acme/feed.json");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      city: "Austin",
      region: "TX",
      country: "US",
      seniority: "senior",
      isRemote: false,
      platform: "jobscore",
      source: "ats",
      applyUrl: "https://careers.jobscore.com/apply_flow/applications/go?job_id=job1id",
    });
    expect(jobs[0].description).toBe("Build great things.");

    expect(jobs[1].isRemote).toBe(true);
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(jobscore.fetch("missing-co")).rejects.toThrow(/404/);
  });
});
