import type { Platform } from "../schema.js";
import type { AtsSeedEntry } from "../seeds/store.js";
import type { AtsMatch } from "./detectAts.js";
import type { YcCompany } from "./ycombinator.js";

export interface DiscoveryDeps {
  fetchCompanies: () => Promise<YcCompany[]>;
  detect: (website: string) => Promise<AtsMatch | null>;
  validate: (platform: Platform, slug: string) => Promise<boolean>;
  readExisting: (platform: Platform) => AtsSeedEntry[];
  writeSeeds: (platform: Platform, entries: AtsSeedEntry[]) => void;
  now: () => string;
  sleep: (ms: number) => Promise<void>;
  delayMs: () => number;
  limit?: number;
}

export interface DiscoverySummary {
  probed: number;
  matched: number;
  validated: number;
  skippedDuplicate: number;
  validationFailed: number;
  noMatch: number;
  byPlatform: Record<string, number>;
}

/** Runs the full discover-seeds pipeline once, using injected deps for all I/O and pacing. */
export async function runDiscovery(deps: DiscoveryDeps): Promise<DiscoverySummary> {
  const allCompanies = await deps.fetchCompanies();
  const companies = deps.limit ? allCompanies.slice(0, deps.limit) : allCompanies;

  const summary: DiscoverySummary = {
    probed: 0,
    matched: 0,
    validated: 0,
    skippedDuplicate: 0,
    validationFailed: 0,
    noMatch: 0,
    byPlatform: {},
  };

  const entriesByPlatform = new Map<Platform, AtsSeedEntry[]>();
  const dirtyPlatforms = new Set<Platform>();

  function entriesFor(platform: Platform): AtsSeedEntry[] {
    let entries = entriesByPlatform.get(platform);
    if (!entries) {
      entries = [...deps.readExisting(platform)];
      entriesByPlatform.set(platform, entries);
    }
    return entries;
  }

  for (const company of companies) {
    summary.probed++;

    const match = await deps.detect(company.website);
    if (!match) {
      summary.noMatch++;
    } else {
      summary.matched++;
      const entries = entriesFor(match.platform);
      if (entries.some((e) => e.slug === match.slug)) {
        summary.skippedDuplicate++;
      } else {
        const ok = await deps.validate(match.platform, match.slug);
        if (!ok) {
          summary.validationFailed++;
        } else {
          entries.push({
            slug: match.slug,
            industries: company.industries,
            tags: company.tags,
            source: "yc-discovery",
            discoveredAt: deps.now(),
          });
          dirtyPlatforms.add(match.platform);
          summary.validated++;
          summary.byPlatform[match.platform] = (summary.byPlatform[match.platform] ?? 0) + 1;
        }
      }
    }

    await deps.sleep(deps.delayMs());
  }

  for (const platform of dirtyPlatforms) {
    deps.writeSeeds(platform, entriesFor(platform));
  }

  return summary;
}
