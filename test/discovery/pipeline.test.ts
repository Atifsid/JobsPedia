import { describe, expect, it, vi } from "vitest";
import { runDiscovery, type DiscoveryDeps } from "../../src/discovery/pipeline.js";
import type { AtsSeedEntry } from "../../src/seeds/store.js";
import type { YcCompany } from "../../src/discovery/ycombinator.js";

function company(overrides: Partial<YcCompany> = {}): YcCompany {
  return { name: "Acme", website: "https://acme.com", industries: ["B2B"], tags: ["fintech"], batch: "W24", ...overrides };
}

function baseDeps(overrides: Partial<DiscoveryDeps> = {}): DiscoveryDeps {
  return {
    fetchCompanies: async () => [],
    detect: async () => null,
    validate: async () => true,
    readExisting: () => [],
    writeSeeds: vi.fn(),
    now: () => "2026-07-03T00:00:00Z",
    sleep: async () => {},
    delayMs: () => 0,
    ...overrides,
  };
}

describe("runDiscovery", () => {
  it("writes a new validated match with provenance fields from the YC company", async () => {
    const writeSeeds = vi.fn();
    const deps = baseDeps({
      fetchCompanies: async () => [company({ name: "Ramp", website: "https://ramp.com", industries: ["Fintech"], tags: ["b2b"] })],
      detect: async () => ({ platform: "ashby", slug: "ramp" }),
      validate: async () => true,
      writeSeeds,
    });

    const summary = await runDiscovery(deps);

    expect(writeSeeds).toHaveBeenCalledWith("ashby", [
      { slug: "ramp", industries: ["Fintech"], tags: ["b2b"], source: "yc-discovery", discoveredAt: "2026-07-03T00:00:00Z" },
    ]);
    expect(summary).toMatchObject({ probed: 1, matched: 1, validated: 1, skippedDuplicate: 0, validationFailed: 0, noMatch: 0 });
    expect(summary.byPlatform).toEqual({ ashby: 1 });
  });

  it("skips a match whose slug is already in that platform's existing seeds, without validating", async () => {
    const validate = vi.fn(async () => true);
    const writeSeeds = vi.fn();
    const deps = baseDeps({
      fetchCompanies: async () => [company()],
      detect: async () => ({ platform: "ashby", slug: "acme" }),
      readExisting: (platform) => (platform === "ashby" ? [seedEntry("acme")] : []),
      validate,
      writeSeeds,
    });

    const summary = await runDiscovery(deps);

    expect(validate).not.toHaveBeenCalled();
    expect(writeSeeds).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ probed: 1, matched: 1, validated: 0, skippedDuplicate: 1 });
  });

  it("does not write a match that fails live validation", async () => {
    const writeSeeds = vi.fn();
    const deps = baseDeps({
      fetchCompanies: async () => [company()],
      detect: async () => ({ platform: "ashby", slug: "acme" }),
      validate: async () => false,
      writeSeeds,
    });

    const summary = await runDiscovery(deps);

    expect(writeSeeds).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ matched: 1, validated: 0, validationFailed: 1 });
  });

  it("counts companies with no ATS match and does not call validate or writeSeeds", async () => {
    const validate = vi.fn(async () => true);
    const writeSeeds = vi.fn();
    const deps = baseDeps({
      fetchCompanies: async () => [company(), company({ name: "Beta", website: "https://beta.com" })],
      detect: async () => null,
      validate,
      writeSeeds,
    });

    const summary = await runDiscovery(deps);

    expect(validate).not.toHaveBeenCalled();
    expect(writeSeeds).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ probed: 2, matched: 0, noMatch: 2 });
  });

  it("respects the limit option, probing only the first N companies", async () => {
    const detect = vi.fn(async () => null);
    const deps = baseDeps({
      fetchCompanies: async () => [company({ name: "A" }), company({ name: "B" }), company({ name: "C" })],
      detect,
      limit: 2,
    });

    const summary = await runDiscovery(deps);

    expect(detect).toHaveBeenCalledTimes(2);
    expect(summary.probed).toBe(2);
  });

  it("paces with sleep(delayMs()) between companies", async () => {
    const sleep = vi.fn(async () => {});
    const deps = baseDeps({
      fetchCompanies: async () => [company({ name: "A" }), company({ name: "B" })],
      sleep,
      delayMs: () => 42,
    });

    await runDiscovery(deps);

    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(42);
  });

  it("accumulates multiple new matches for the same platform into one writeSeeds call, appended to existing entries", async () => {
    const writeSeeds = vi.fn();
    const deps = baseDeps({
      fetchCompanies: async () => [
        company({ name: "A", website: "https://a.com" }),
        company({ name: "B", website: "https://b.com" }),
      ],
      detect: async (website) => (website.includes("a.com") ? { platform: "ashby", slug: "a" } : { platform: "ashby", slug: "b" }),
      readExisting: () => [seedEntry("existing")],
      validate: async () => true,
      writeSeeds,
    });

    await runDiscovery(deps);

    expect(writeSeeds).toHaveBeenCalledTimes(1);
    const [, entries] = writeSeeds.mock.calls[0];
    expect(entries.map((e: AtsSeedEntry) => e.slug).sort()).toEqual(["a", "b", "existing"]);
  });
});

function seedEntry(slug: string): AtsSeedEntry {
  return { slug, industries: [], tags: [], source: "manual", discoveredAt: "2020-01-01T00:00:00Z" };
}
