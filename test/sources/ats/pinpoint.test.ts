import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pinpoint } from "../../../src/sources/ats/pinpoint.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/pinpoint.json", import.meta.url)), "utf-8"),
);

describe("pinpoint provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps postings into the canonical schema", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await pinpoint.fetch("workwithus");

    expect(fetchMock).toHaveBeenCalledWith("https://workwithus.pinpointhq.com/postings.json");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Product Reliability Engineer",
      company: "Workwithus",
      city: "London",
      region: "England",
      isRemote: true,
      salaryMin: 60000,
      salaryMax: 70000,
      currency: "GBP",
      applyUrl: "https://workwithus.pinpointhq.com/postings/11111",
      platform: "pinpoint",
      source: "ats",
      visaSponsorship: null,
      datePosted: null,
    });
    expect(jobs[0].description).toBe("Build reliable systems.");

    expect(jobs[1]).toMatchObject({
      title: "Support Specialist",
      isRemote: false,
      salaryMin: null,
      salaryMax: null,
      currency: null,
    });
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(pinpoint.fetch("workwithus")).rejects.toThrow(/404/);
  });
});
