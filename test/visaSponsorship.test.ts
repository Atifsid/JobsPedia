import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchH1BSponsors,
  normalizeCompanyName,
  tagVisaSponsorship,
} from "../src/visaSponsorship.js";
import type { NewJob } from "../src/schema.js";

const csvFixture = readFileSync(
  fileURLToPath(new URL("./fixtures/uscis-h1b.csv", import.meta.url)),
  "utf-8",
);

describe("normalizeCompanyName", () => {
  it("lowercases, strips legal suffixes and punctuation, collapses whitespace", () => {
    expect(normalizeCompanyName("Acme Corp, Inc.")).toBe("acme corp");
    expect(normalizeCompanyName("Beta LLC")).toBe("beta");
    expect(normalizeCompanyName("  Gamma   Co.  ")).toBe("gamma");
  });
});

describe("fetchH1BSponsors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tries the current year first, falls back on 404, and returns only employers with at least one approval", async () => {
    const currentYear = new Date().getFullYear();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes(`${currentYear + 1}`)) return { ok: false, status: 404, text: async () => "" };
      if (url.includes(`${currentYear}`)) return { ok: false, status: 404, text: async () => "" };
      return { ok: true, text: async () => csvFixture };
    });
    vi.stubGlobal("fetch", fetchMock);

    const sponsors = await fetchH1BSponsors();

    expect(sponsors.has("acme corp")).toBe(true);
    expect(sponsors.has("beta")).toBe(false);
    expect(sponsors.has("gamma")).toBe(false);
  });

  it("treats a comma-formatted (quoted) approval count as a number, not NaN", async () => {
    const csvWithThousandsSeparator = [
      '"Fiscal Year",Employer,"Initial Approval","Initial Denial","Continuing Approval","Continuing Denial",NAICS,"Tax ID",State,City,ZIP',
      '2023,"Delta Corp","1,000",0,0,0,51,3456,CA,LOS ANGELES,90001',
    ].join("\n");
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => csvWithThousandsSeparator }));
    vi.stubGlobal("fetch", fetchMock);

    const sponsors = await fetchH1BSponsors();

    // "Corp" is stripped as a legal suffix by normalizeCompanyName, so "Delta Corp" -> "delta".
    expect(sponsors.has("delta")).toBe(true);
  });
});

describe("tagVisaSponsorship", () => {
  const baseJob: NewJob = {
    id: "1",
    title: "Engineer",
    company: "Acme Corp, Inc.",
    location: null,
    city: null,
    region: null,
    country: null,
    seniority: null,
    isRemote: false,
    visaSponsorship: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    applyUrl: "https://example.com/job/1",
    description: null,
    datePosted: null,
    platform: "greenhouse",
    source: "ats",
  };

  it("sets visaSponsorship true when the normalized company matches a known sponsor", () => {
    const sponsors = new Set(["acme corp"]);
    const [tagged] = tagVisaSponsorship([baseJob], sponsors);
    expect(tagged.visaSponsorship).toBe(true);
  });

  it("leaves visaSponsorship as-is (null) when there is no match", () => {
    const sponsors = new Set(["someone-else"]);
    const [tagged] = tagVisaSponsorship([baseJob], sponsors);
    expect(tagged.visaSponsorship).toBeNull();
  });

  it("never downgrades an existing true to null or sets false", () => {
    const alreadyTrue: NewJob = { ...baseJob, visaSponsorship: true };
    const sponsors = new Set<string>();
    const [tagged] = tagVisaSponsorship([alreadyTrue], sponsors);
    expect(tagged.visaSponsorship).toBe(true);
  });
});
