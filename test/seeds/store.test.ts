import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listSeedPlatforms, loadAllSeeds, readSeedFile, writeSeedFile } from "../../src/seeds/store.js";

describe("seeds/store", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "jobspedia-seeds-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists platforms from json filenames in the seeds directory", () => {
    writeSeedFile("greenhouse", [], dir);
    writeSeedFile("lever", [], dir);
    expect(listSeedPlatforms(dir).sort()).toEqual(["greenhouse", "lever"]);
  });

  it("returns an empty list for an empty directory", () => {
    expect(listSeedPlatforms(dir)).toEqual([]);
  });

  it("round-trips entries through writeSeedFile and readSeedFile, sorted by slug", () => {
    writeSeedFile(
      "greenhouse",
      [
        { slug: "zeta", industries: [], tags: [], source: "manual", discoveredAt: "2026-07-03T00:00:00Z" },
        {
          slug: "alpha",
          industries: ["fintech"],
          tags: ["b2b"],
          source: "yc-discovery",
          discoveredAt: "2026-07-03T00:00:00Z",
        },
      ],
      dir,
    );
    const entries = readSeedFile("greenhouse", dir);
    expect(entries.map((e) => e.slug)).toEqual(["alpha", "zeta"]);
    expect(entries[0]).toMatchObject({ industries: ["fintech"], tags: ["b2b"], source: "yc-discovery" });
  });

  it("throws a clear error when a seed file fails schema validation", () => {
    writeFileSync(join(dir, "lever.json"), JSON.stringify([{ slug: "x" }]), "utf-8");
    expect(() => readSeedFile("lever", dir)).toThrow();
  });

  it("returns an empty list when the platform's seed file doesn't exist yet", () => {
    expect(readSeedFile("ashby", dir)).toEqual([]);
  });

  it("loadAllSeeds flattens every platform's entries with the platform field attached", () => {
    writeSeedFile(
      "greenhouse",
      [{ slug: "acme", industries: [], tags: [], source: "manual", discoveredAt: "2026-07-03T00:00:00Z" }],
      dir,
    );
    writeSeedFile(
      "lever",
      [{ slug: "beta", industries: [], tags: [], source: "manual", discoveredAt: "2026-07-03T00:00:00Z" }],
      dir,
    );
    const seeds = loadAllSeeds(dir);
    expect(seeds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ platform: "greenhouse", slug: "acme" }),
        expect.objectContaining({ platform: "lever", slug: "beta" }),
      ]),
    );
    expect(seeds).toHaveLength(2);
  });
});
