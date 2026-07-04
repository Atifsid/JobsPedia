import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { teamtailor } from "../../../src/sources/ats/teamtailor.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/teamtailor.json", import.meta.url)), "utf-8"),
);

describe("teamtailor provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the JSON Feed into the canonical schema", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await teamtailor.fetch("acme");

    expect(fetchMock).toHaveBeenCalledWith("https://acme.teamtailor.com/jobs.json");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Legal Counsel",
      company: "Acme Corp",
      city: "Stockholm",
      country: "SE",
      isRemote: false,
      applyUrl: "https://acme.teamtailor.com/jobs/8002146-senior-legal-counsel",
      platform: "teamtailor",
      source: "ats",
      visaSponsorship: null,
    });
    expect(jobs[0].description).toBe("Join our legal team.");
    expect(jobs[0].datePosted).toBe("2026-06-01T11:55:38.000Z");

    expect(jobs[1]).toMatchObject({
      title: "Remote Support Engineer",
      city: null,
      country: null,
      isRemote: true,
    });
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(teamtailor.fetch("acme")).rejects.toThrow(/500/);
  });
});
