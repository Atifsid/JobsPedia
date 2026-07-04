import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { oracleRecruitingCloud } from "../../../src/sources/ats/oracle_recruiting_cloud.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/oracle_recruiting_cloud.json", import.meta.url)), "utf-8"),
);

const page2 = {
  items: [
    {
      TotalJobsCount: 3,
      requisitionList: [
        {
          Id: "210598111",
          Title: "Platform Engineer",
          PostedDate: "2026-06-17",
          PrimaryLocation: "New York, NY, United States",
          PrimaryLocationCountry: "US",
          JobFamily: "Engineering",
          JobFunction: "Engineering",
          ShortDescriptionStr: "Own our internal platform.",
          WorkplaceType: "",
          workLocation: [{ LocationId: 1, LocationName: "NYC HQ", TownOrCity: "New York", Country: "US", Region2: "US-NY" }],
        },
      ],
    },
  ],
  count: 1,
  hasMore: false,
  limit: 50,
  offset: 50,
  links: [],
};

describe("oracle_recruiting_cloud provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("paginates until TotalJobsCount is reached, using the compound host:siteNumber slug", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      // PAGE_SIZE is 50 — with TotalJobsCount: 3 and 2 requisitions on the first page,
      // paginate() advances offset from 0 to 50 for the second call.
      const isSecondPage = new URL(url).searchParams.get("finder")?.includes("offset=50");
      if (isSecondPage) return { ok: true, json: async () => page2 };
      return { ok: true, json: async () => fixture };
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await oracleRecruitingCloud.fetch("jpmc.fa.oraclecloud.com:CX_1001");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions" +
        "?onlyData=true&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations" +
        "&finder=findReqs;siteNumber=CX_1001,limit=50,offset=0",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions" +
        "?onlyData=true&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations" +
        "&finder=findReqs;siteNumber=CX_1001,limit=50,offset=50",
    );
    expect(jobs).toHaveLength(3);
    expect(jobs[2].title).toBe("Platform Engineer");

    expect(jobs[0]).toMatchObject({
      title: "Corporate Payments Sales Manager - Vice President",
      city: "Tokyo",
      region: "JP-13",
      country: "JP",
      applyUrl: "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210597507",
      platform: "oracle_recruiting_cloud",
      source: "ats",
      visaSponsorship: null,
      isRemote: false,
    });
    expect(jobs[0].description).toBe("Join the team as a HQ Payments Sales Manager.");
    expect(jobs[0].datePosted).toBe("2026-06-15T00:00:00.000Z");

    expect(jobs[1]).toMatchObject({ title: "Remote Data Engineer", isRemote: true, city: null });
  });

  it("throws a clear error when the slug isn't in the expected host:siteNumber shape", async () => {
    await expect(oracleRecruitingCloud.fetch("not-a-compound-slug")).rejects.toThrow(
      /oracle_recruiting_cloud slug must be/,
    );
  });

  it("throws on a non-OK response so the crawl can log and skip it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
    await expect(oracleRecruitingCloud.fetch("jpmc.fa.oraclecloud.com:CX_1001")).rejects.toThrow(/404/);
  });
});
