import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eightfold } from "../../../src/sources/ats/eightfold.js";

const page1 = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/eightfold.json", import.meta.url)), "utf-8"),
);
const detail = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/eightfold-detail.json", import.meta.url)), "utf-8"),
);

const page2 = {
  positions: [
    {
      id: 171841265956,
      name: "Platform Engineer",
      location: "Bengaluru,India",
      department: "Platform",
      t_create: 1780223200,
      canonicalPositionUrl: "https://acme.eightfold.ai/careers/job/171841265956",
      work_location_option: "onsite",
      job_description: "",
    },
  ],
  count: 3,
};

describe("eightfold provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("paginates until count is reached, fetches detail per position, using the compound tenant:domain slug", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/jobs/171841265954")) return { ok: true, json: async () => detail };
      if (url.includes("/jobs/171841265955") || url.includes("/jobs/171841265956")) {
        return { ok: true, json: async () => ({ ...page1.positions[1], job_description: "" }) };
      }
      // PAGE_SIZE is 10 (the real, live-confirmed value) — with count: 3 and 2 positions on
      // the first page, paginate() advances offset from 0 to 10 for the second call.
      const start = new URL(url).searchParams.get("start");
      if (start === "10") return { ok: true, json: async () => page2 };
      return { ok: true, json: async () => page1 };
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await eightfold.fetch("acme:acme.com");

    expect(fetchMock).toHaveBeenCalledWith("https://acme.eightfold.ai/api/apply/v2/jobs?domain=acme.com&hl=en&start=0");
    expect(fetchMock).toHaveBeenCalledWith("https://acme.eightfold.ai/api/apply/v2/jobs?domain=acme.com&hl=en&start=10");
    expect(jobs).toHaveLength(3);
    expect(jobs[2].title).toBe("Platform Engineer");

    expect(jobs[0]).toMatchObject({
      title: "Cloud Engineer III",
      company: "Acme",
      city: "Gurugram",
      country: "India",
      isRemote: false,
      applyUrl: "https://acme.eightfold.ai/careers/job/171841265954",
      platform: "eightfold",
      source: "ats",
      visaSponsorship: null,
    });
    expect(jobs[0].description).toBe("Manage our cloud infrastructure.");

    expect(jobs[1]).toMatchObject({ title: "Remote Data Analyst", isRemote: true });
  });

  it("throws a clear error when the slug isn't in the expected tenant:domain shape", async () => {
    await expect(eightfold.fetch("not-a-compound-slug")).rejects.toThrow(/eightfold slug must be/);
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(eightfold.fetch("acme:acme.com")).rejects.toThrow(/404/);
  });
});
