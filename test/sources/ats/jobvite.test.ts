import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jobvite } from "../../../src/sources/ats/jobvite.js";

const html = readFileSync(fileURLToPath(new URL("../../fixtures/jobvite.html", import.meta.url)), "utf-8");

describe("jobvite provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("scrapes the job-list table into the canonical schema", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => html }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await jobvite.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith("https://jobs.jobvite.com/careers/acme/jobs");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme",
      city: "Portland",
      region: "OR",
      country: "US",
      seniority: "senior",
      applyUrl: "https://jobs.jobvite.com/acme/job/aaa111",
      platform: "jobvite",
      source: "ats",
      visaSponsorship: null,
      description: null,
    });

    expect(jobs[1]).toMatchObject({
      title: "Support Engineer",
      city: "2 Locations",
    });
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })));
    await expect(jobvite.fetch("acme")).rejects.toThrow(/404/);
  });
});
