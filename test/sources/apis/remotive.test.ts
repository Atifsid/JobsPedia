import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { remotive } from "../../../src/sources/apis/remotive.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/remotive.json", import.meta.url)), "utf-8"),
);

describe("remotive provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the job list into the canonical schema without hitting the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await remotive.fetch();

    expect(fetchMock).toHaveBeenCalledWith("https://remotive.com/api/remote-jobs");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      isRemote: true,
      salaryMin: null,
      salaryMax: null,
      applyUrl: "https://remotive.com/remote-jobs/software-dev/senior-backend-engineer-111111",
      platform: "remotive",
      source: "aggregator",
      visaSponsorship: null,
    });
    expect(jobs[0].description).toBe("Build great things.");
    expect(jobs[1].isRemote).toBe(true);
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(remotive.fetch()).rejects.toThrow(/500/);
  });
});
