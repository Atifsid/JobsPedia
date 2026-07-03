import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { themuse } from "../../../src/sources/apis/themuse.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/themuse.json", import.meta.url)), "utf-8"),
);

const emptyPage = { results: [] };

describe("themuse provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps postings into the canonical schema, paginating each configured category and stopping on an empty page", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const page = new URL(url).searchParams.get("page");
      if (page === "1") return { ok: true, json: async () => fixture };
      return { ok: true, json: async () => emptyPage };
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await themuse.fetch();

    // 2 configured categories x 1 non-empty page each (page 2 is empty, stopping the loop early)
    expect(jobs).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.themuse.com/api/public/jobs?page=1&category=Software%20Engineering",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.themuse.com/api/public/jobs?page=1&category=Data%20and%20Analytics",
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      city: "New York",
      region: "NY",
      country: "US",
      seniority: "senior",
      isRemote: false,
      applyUrl: "https://www.themuse.com/jobs/acmecorp/senior-backend-engineer-111111",
      platform: "themuse",
      source: "aggregator",
      visaSponsorship: null,
    });
    expect(jobs[0].description).toBe("Build great backend systems.");

    expect(jobs[1]).toMatchObject({
      title: "Support Engineer",
      isRemote: true,
      seniority: "mid",
    });
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(themuse.fetch()).rejects.toThrow(/500/);
  });
});
