import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bamboohr } from "../../../src/sources/ats/bamboohr.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/bamboohr.json", import.meta.url)), "utf-8"),
);

describe("bamboohr scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches the job list, fetches per-job detail, and maps into the canonical schema", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/careers/list")) return { ok: true, json: async () => fixture.list };
      if (url.endsWith("/careers/301/detail")) return { ok: true, json: async () => fixture.details["301"] };
      if (url.endsWith("/careers/302/detail")) return { ok: true, json: async () => fixture.details["302"] };
      throw new Error(`unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await bamboohr.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith("https://acme.bamboohr.com/careers/list");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme",
      city: "Austin",
      region: "TX",
      seniority: "senior",
      isRemote: false,
      platform: "bamboohr",
      source: "ats",
      applyUrl: "https://acme.bamboohr.com/careers/301",
    });
    expect(jobs[0].description).toBe("Build great things.");

    expect(jobs[1].isRemote).toBe(true);
    expect(jobs[1].description).toBe("Help our customers.");
  });

  it("throws on a non-OK response from the list call so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(bamboohr.fetch("missing-co")).rejects.toThrow(/404/);
  });
});
