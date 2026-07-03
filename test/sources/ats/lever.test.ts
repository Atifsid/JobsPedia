import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lever } from "../../../src/sources/ats/lever.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/lever.json", import.meta.url)), "utf-8"),
);

describe("lever scraper", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps postings into the canonical schema, deriving company from the slug", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => fixture })));

    const jobs = await lever.fetch("acme");

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: "Senior Backend Engineer",
      company: "Acme",
      isRemote: true,
      country: "US",
      seniority: "senior",
      salaryMin: 150000,
      salaryMax: 190000,
      currency: "USD",
      platform: "lever",
      source: "ats",
      applyUrl: "https://jobs.lever.co/acme/abc-123",
    });

    expect(jobs[1]).toMatchObject({
      title: "Sales Development Rep",
      city: "New York",
      region: "NY",
      country: "US",
      seniority: "mid",
      isRemote: false,
      salaryMin: null,
      salaryMax: null,
    });
  });
});
