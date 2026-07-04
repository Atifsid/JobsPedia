import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adzuna } from "../../../src/sources/apis/adzuna.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/adzuna.json", import.meta.url)), "utf-8"),
);

describe("adzuna provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("throws a clear error when ADZUNA_APP_ID/ADZUNA_APP_KEY are not set", async () => {
    vi.stubEnv("ADZUNA_APP_ID", "");
    vi.stubEnv("ADZUNA_APP_KEY", "");
    await expect(adzuna.fetch()).rejects.toThrow(/ADZUNA_APP_ID\/ADZUNA_APP_KEY not set/);
  });

  it("maps the job list into the canonical schema, looping every configured country x search term and accumulating results", async () => {
    vi.stubEnv("ADZUNA_APP_ID", "test-id");
    vi.stubEnv("ADZUNA_APP_KEY", "test-key");
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await adzuna.fetch();

    // Verify multiple specific calls with different countries/terms are made
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=test-id&app_key=test-key&results_per_page=50&what=software%20engineer&content-type=application/json",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=test-id&app_key=test-key&results_per_page=50&what=software%20engineer&content-type=application/json",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=test-id&app_key=test-key&results_per_page=50&what=backend%20engineer&content-type=application/json",
    );

    // Verify call count matches countries (2) × searchTerms (10) = 20 calls
    expect(fetchMock).toHaveBeenCalledTimes(20);

    // Verify accumulation: 20 calls × 2 jobs per fixture = 40 jobs
    expect(jobs).toHaveLength(40);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      city: "London",
      country: "UK",
      seniority: "senior",
      isRemote: false,
      salaryMin: 80000,
      salaryMax: 100000,
      applyUrl: "https://www.adzuna.co.uk/land/ad/111111",
      platform: "adzuna",
      source: "aggregator",
      visaSponsorship: null,
    });
    expect(jobs[0].description).toBe("Build great things.");

    const remoteJob = jobs.find((j) => j.title === "Remote Support Engineer");
    expect(remoteJob?.isRemote).toBe(true);
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubEnv("ADZUNA_APP_ID", "test-id");
    vi.stubEnv("ADZUNA_APP_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(adzuna.fetch()).rejects.toThrow(/500/);
  });
});
