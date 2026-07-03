import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { remotejobsorg } from "../../../src/sources/apis/remotejobsorg.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/remotejobsorg.json", import.meta.url)), "utf-8"),
);

const page2 = {
  data: [
    {
      id: "333333",
      title: "Platform Engineer",
      url: "https://remotejobs.org/remote-jobs/platform-engineer-acme-corp",
      apply_url: "https://remotejobs.org/remote-jobs/platform-engineer-acme-corp",
      company: {
        name: "Acme Corp",
        logo_url: "",
        website: "https://acme.example",
        url: "https://remotejobs.org/companies/acme-corp",
      },
      category: { name: "Programming", slug: "programming" },
      location: "Remote",
      salary_min: null,
      salary_max: null,
      salary_text: null,
      type: "Full-time",
      description: "<p>Run our platform.</p>",
      posted_at: "2026-03-01T10:00:00+00:00",
      is_translated: false,
      original_language: null,
    },
  ],
  pagination: { total: 3, limit: 50, offset: 50, has_more: false },
  meta: {
    powered_by: "RemoteJobs.org",
    url: "https://remotejobs.org",
    docs: "https://remotejobs.org/api/v1/docs",
  },
};

describe("remotejobsorg provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the job list into the canonical schema, paginating until the reported total is reached, falling back to url when apply_url is null", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const offset = new URL(url).searchParams.get("offset");
      if (offset === "50") return { ok: true, json: async () => page2 };
      return { ok: true, json: async () => fixture };
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await remotejobsorg.fetch();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://remotejobs.org/api/v1/jobs?category=programming&limit=50&offset=0",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://remotejobs.org/api/v1/jobs?category=programming&limit=50&offset=50",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(jobs).toHaveLength(3);

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

    expect(jobs[2].title).toBe("Platform Engineer");
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(remotejobsorg.fetch()).rejects.toThrow(/500/);
  });
});
