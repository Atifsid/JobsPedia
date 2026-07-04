import { describe, expect, it } from "vitest";
import { atsSeeds } from "../src/config.js";

describe("atsSeeds (loaded from src/seeds/*.json)", () => {
  it("loads all 25 seeds across 18 platforms, unchanged in slug/platform", () => {
    expect(atsSeeds).toHaveLength(25);
    const byPlatform = new Map<string, string[]>();
    for (const seed of atsSeeds) {
      byPlatform.set(seed.platform, [...(byPlatform.get(seed.platform) ?? []), seed.slug]);
    }
    expect(byPlatform.get("greenhouse")?.sort()).toEqual(["airbnb", "cloudflare", "figma", "stripe"]);
    expect(byPlatform.get("lever")?.sort()).toEqual(["achievers", "gohighlevel", "q-ctrl"]);
    expect(byPlatform.get("ashby")?.sort()).toEqual(["linear", "notion", "ramp"]);
    expect(byPlatform.get("workable")).toEqual(["jobrack"]);
    expect(byPlatform.get("breezyhr")).toEqual(["new-incentives"]);
    expect(byPlatform.get("jobscore")).toEqual(["jobscore"]);
    expect(byPlatform.get("personio")).toEqual(["personio"]);
    expect(byPlatform.get("recruitee")).toEqual(["jobs"]);
    expect(byPlatform.get("smartrecruiters")).toEqual(["visa"]);
    expect(byPlatform.get("comeet")).toEqual(["61.003:16358C6EF2C61631639B558C0429"]);
    expect(byPlatform.get("bamboohr")).toEqual(["soundstripe"]);
    expect(byPlatform.get("teamtailor")).toEqual(["oneflow"]);
    expect(byPlatform.get("pinpoint")).toEqual(["workwithus"]);
    expect(byPlatform.get("rippling")).toEqual(["cars-and-bids-job-board"]);
    expect(byPlatform.get("oracle_recruiting_cloud")).toEqual(["jpmc.fa.oraclecloud.com:CX_1001"]);
    expect(byPlatform.get("sap_successfactors")).toEqual(["job.schindler.com"]);
    expect(byPlatform.get("eightfold")).toEqual(["insight:insight.com"]);
    expect(byPlatform.get("jobvite")).toEqual(["carfax"]);
  });

  it("every seed has the extended fields --scope filtering and discovery provenance rely on", () => {
    for (const seed of atsSeeds) {
      expect(Array.isArray(seed.industries)).toBe(true);
      expect(Array.isArray(seed.tags)).toBe(true);
      expect(["manual", "yc-discovery"]).toContain(seed.source);
      expect(typeof seed.discoveredAt).toBe("string");
    }
  });
});
