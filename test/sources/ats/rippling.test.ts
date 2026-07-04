import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rippling } from "../../../src/sources/ats/rippling.js";

const page1 = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/rippling.json", import.meta.url)), "utf-8"),
);
const detail = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/rippling-detail.json", import.meta.url)), "utf-8"),
);

const page2 = {
  items: [
    {
      id: "job-3",
      name: "Platform Engineer",
      url: "https://ats.rippling.com/cars-and-bids-job-board/jobs/job-3",
      locations: [{ name: "Remote (United States)", country: "United States", countryCode: "US", workplaceType: "REMOTE" }],
    },
  ],
  page: 1,
  pageSize: 20,
  totalItems: 3,
  totalPages: 2,
};

describe("rippling provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("paginates until totalItems is reached and fetches a detail call per job", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/jobs/job-1") || url.includes("/jobs/job-2") || url.includes("/jobs/job-3")) {
        return { ok: true, json: async () => detail };
      }
      const page = new URL(url).searchParams.get("page");
      if (page === "2") return { ok: true, json: async () => page2 };
      return { ok: true, json: async () => page1 };
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await rippling.fetch("cars-and-bids-job-board");

    // PAGE_SIZE is 20 (the real, live-confirmed value) — with totalItems: 3 and 2 items on
    // page 1, paginate() advances offset by 20, which rippling.ts converts to page=2.
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ats.rippling.com/api/v2/board/cars-and-bids-job-board/jobs?page=1&pageSize=20",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ats.rippling.com/api/v2/board/cars-and-bids-job-board/jobs?page=2&pageSize=20",
    );
    expect(jobs).toHaveLength(3);
    expect(jobs[2].title).toBe("Platform Engineer");

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Cars And Bids",
      country: "US",
      isRemote: true,
      applyUrl: "https://ats.rippling.com/cars-and-bids-job-board/jobs/job-1",
      platform: "rippling",
      source: "ats",
      visaSponsorship: null,
    });
    expect(jobs[0].description).toBe("Own our backend services.\n\nWe help people buy and sell cars.");

    expect(jobs[1]).toMatchObject({ title: "Support Associate", isRemote: false });
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(rippling.fetch("cars-and-bids-job-board")).rejects.toThrow(/404/);
  });
});
