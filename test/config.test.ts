import { describe, expect, it } from "vitest";
import { atsSeeds } from "../src/config.js";

describe("atsSeeds (loaded from src/seeds/*.json)", () => {
  it("loads all 18 originally hand-picked seeds across 11 platforms, unchanged in slug/platform", () => {
    expect(atsSeeds).toHaveLength(18);
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
