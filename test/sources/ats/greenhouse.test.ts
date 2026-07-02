import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { greenhouse } from "../../../src/sources/ats/greenhouse.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/greenhouse.json", import.meta.url)), "utf-8"),
);

describe("greenhouse scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a board's jobs into the canonical schema without hitting the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await greenhouse.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true",
    );
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Software Engineer, Backend",
      company: "Acme Corp",
      city: "San Francisco",
      region: "CA",
      country: "US",
      isRemote: false,
      platform: "greenhouse",
      source: "ats",
      applyUrl: "https://boards.greenhouse.io/acme/jobs/111",
    });
    expect(jobs[0].description).toContain("Build great things.");
    expect(jobs[0].description).not.toContain("<p>");

    expect(jobs[1].isRemote).toBe(true);
    expect(jobs[1].city).toBeNull();
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(greenhouse.fetch("missing-co")).rejects.toThrow(/404/);
  });
});
