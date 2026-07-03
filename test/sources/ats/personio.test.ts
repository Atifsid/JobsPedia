import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { personio } from "../../../src/sources/ats/personio.js";

const fixtureXml = readFileSync(
  fileURLToPath(new URL("../../fixtures/personio.xml", import.meta.url)),
  "utf-8",
);

describe("personio scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a company's XML feed into the canonical schema without hitting the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => fixtureXml }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await personio.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith("https://acme.jobs.personio.de/xml?language=en");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme",
      city: "Berlin",
      seniority: "senior",
      isRemote: false,
      platform: "personio",
      source: "ats",
      applyUrl: "https://acme.jobs.personio.de/job/1001",
    });
    expect(jobs[0].description).toBe("Build great things.");

    expect(jobs[1].isRemote).toBe(true);
    expect(jobs[1].city).toBeNull();
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })));
    await expect(personio.fetch("missing-co")).rejects.toThrow(/404/);
  });
});
