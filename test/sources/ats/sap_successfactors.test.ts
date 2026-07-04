import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sapSuccessfactors } from "../../../src/sources/ats/sap_successfactors.js";

const xml = readFileSync(fileURLToPath(new URL("../../fixtures/sap_successfactors.xml", import.meta.url)), "utf-8");

describe("sap_successfactors provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses the RSS/XML full-board feed into the canonical schema", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => xml }));
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await sapSuccessfactors.fetch("job.acmecorp.com");

    expect(fetchMock).toHaveBeenCalledWith("https://job.acmecorp.com/sitemal.xml");
    expect(jobs).toHaveLength(2);

    expect(jobs[0]).toMatchObject({
      title: "Service Operations Manager (Chicago, IL, US)",
      company: "Acme Corp",
      city: "Chicago",
      region: "IL",
      country: "US",
      isRemote: false,
      applyUrl: "https://job.acmecorp.com/Acme/job/Chicago-Service-Operations-Manager/1405291933/",
      platform: "sap_successfactors",
      source: "ats",
      visaSponsorship: null,
      datePosted: null,
    });
    expect(jobs[0].description).toBe("Manage our service operations team.");

    expect(jobs[1]).toMatchObject({ title: "Remote Support Engineer", isRemote: true });
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })));
    await expect(sapSuccessfactors.fetch("job.acmecorp.com")).rejects.toThrow(/404/);
  });
});
