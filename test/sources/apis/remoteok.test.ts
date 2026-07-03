import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { remoteok } from "../../../src/sources/apis/remoteok.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/remoteok.json", import.meta.url)), "utf-8"),
);

describe("remoteok provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the job list into the canonical schema, skipping the legal-notice entry, without hitting the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await remoteok.fetch();

    expect(fetchMock).toHaveBeenCalledWith("https://remoteok.com/api");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      seniority: "senior",
      isRemote: true,
      salaryMin: 120000,
      salaryMax: 160000,
      applyUrl: "https://remoteok.com/remote-jobs/senior-backend-engineer-acme-corp-111111",
      platform: "remoteok",
      source: "aggregator",
      visaSponsorship: null,
    });
    expect(jobs[0].description).toBe("Build great things.");

    expect(jobs[1].isRemote).toBe(true);
    expect(jobs[1].salaryMin).toBeNull();
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(remoteok.fetch()).rejects.toThrow(/500/);
  });
});
