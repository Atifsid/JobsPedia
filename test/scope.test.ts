import { describe, expect, it } from "vitest";
import { filterByScope, matchesScope, parseScope } from "../src/scope.js";
import type { AtsSeed } from "../src/config.js";

function seed(overrides: Partial<AtsSeed> = {}): AtsSeed {
  return {
    platform: "greenhouse",
    slug: "acme",
    industries: [],
    tags: [],
    source: "manual",
    discoveredAt: "2026-07-03T00:00:00Z",
    ...overrides,
  };
}

describe("parseScope", () => {
  it("returns the value after --scope", () => {
    expect(parseScope(["--scope", "fintech"])).toBe("fintech");
  });

  it("returns undefined when --scope is absent", () => {
    expect(parseScope(["--only", "ats"])).toBeUndefined();
  });
});

describe("matchesScope", () => {
  it("matches case-insensitively against industries", () => {
    expect(matchesScope(seed({ industries: ["Fintech"] }), "fintech")).toBe(true);
  });

  it("matches case-insensitively against tags", () => {
    expect(matchesScope(seed({ tags: ["B2B"] }), "b2b")).toBe(true);
  });

  it("does not match when neither industries nor tags contain the scope", () => {
    expect(matchesScope(seed({ industries: ["Healthcare"], tags: ["b2c"] }), "fintech")).toBe(false);
  });

  it("does not match a manually-curated seed with empty industries/tags", () => {
    expect(matchesScope(seed(), "fintech")).toBe(false);
  });
});

describe("filterByScope", () => {
  it("returns all seeds unchanged when scope is undefined", () => {
    const seeds = [seed({ slug: "a" }), seed({ slug: "b", industries: ["Fintech"] })];
    expect(filterByScope(seeds, undefined)).toEqual(seeds);
  });

  it("filters to only seeds matching the scope", () => {
    const seeds = [seed({ slug: "a" }), seed({ slug: "b", industries: ["Fintech"] })];
    expect(filterByScope(seeds, "fintech").map((s) => s.slug)).toEqual(["b"]);
  });
});
