import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { comeet } from "../../../src/sources/ats/comeet.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/comeet.json", import.meta.url)), "utf-8"),
);

describe("comeet scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps a company's positions into the canonical schema without hitting the network", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => fixture }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await comeet.fetch("acme:TESTTOKEN123");

    // Comeet's public list-positions endpoint 400s with "Token is missing" unless a
    // per-company API token is supplied as a query param (discovered via live probing —
    // see task-14-report.md). The seed slug therefore encodes "<company_uid>:<token>".
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.comeet.co/careers-api/2.0/company/acme/positions?token=TESTTOKEN123",
    );
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme Corp",
      city: "Austin",
      region: "TX",
      country: "US",
      seniority: "senior",
      isRemote: false,
      platform: "comeet",
      source: "ats",
      applyUrl: "https://www.comeet.com/jobs/acme/12.345/senior-backend-engineer/AB1",
    });
    expect(jobs[0].description).toContain("Build great things.");
    expect(jobs[0].description).toContain("5+ years experience.");

    expect(jobs[1].isRemote).toBe(true);
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(comeet.fetch("missing-co:sometoken")).rejects.toThrow(/404/);
  });
});
