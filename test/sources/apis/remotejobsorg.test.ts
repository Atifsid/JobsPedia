import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { remotejobsorg } from "../../../src/sources/apis/remotejobsorg.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/remotejobsorg.json", import.meta.url)), "utf-8"),
);

describe("remotejobsorg provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the job list into the canonical schema, falling back to url when apply_url is null", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await remotejobsorg.fetch();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://remotejobs.org/api/v1/jobs?category=programming&limit=50&offset=0",
    );
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      location: "Remote",
      seniority: "senior",
      isRemote: true,
      salaryMin: 120000,
      salaryMax: 160000,
      applyUrl: "https://remotejobs.org/remote-jobs/senior-backend-engineer-acme-corp",
      platform: "remotejobsorg",
      source: "aggregator",
      visaSponsorship: null,
    });
    expect(jobs[0].description).toBe("Build great things.");

    expect(jobs[1].applyUrl).toBe("https://remotejobs.org/remote-jobs/support-engineer-acme-corp");
    expect(jobs[1].salaryMin).toBeNull();
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(remotejobsorg.fetch()).rejects.toThrow(/500/);
  });
});
