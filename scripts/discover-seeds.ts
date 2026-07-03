import type { Platform } from "../src/schema.js";
import { detectAts } from "../src/discovery/detectAts.js";
import { runDiscovery } from "../src/discovery/pipeline.js";
import { fetchYcCompanies } from "../src/discovery/ycombinator.js";
import { readSeedFile, writeSeedFile } from "../src/seeds/store.js";
import { atsScrapers } from "../src/sources/ats/index.js";

// Probing ~1,481 distinct third-party sites, not repeatedly hitting one shared vendor
// (unlike crawlAggregators()'s 5-10s LinkedIn-focused delay in crawl.ts) — a lighter
// per-site delay is polite here while keeping a full run practical.
const DISCOVER_DELAY_MIN_MS = 500;
const DISCOVER_DELAY_MAX_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): number {
  return Math.floor(Math.random() * (DISCOVER_DELAY_MAX_MS - DISCOVER_DELAY_MIN_MS + 1)) + DISCOVER_DELAY_MIN_MS;
}

function parseLimit(argv: string[]): number | undefined {
  const idx = argv.indexOf("--limit");
  if (idx === -1) return undefined;
  const n = Number(argv[idx + 1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function validateSlug(platform: Platform, slug: string): Promise<boolean> {
  const scraper = atsScrapers.find((s) => s.platform === platform);
  if (!scraper) return false;
  try {
    const jobs = await scraper.fetch(slug);
    return jobs.length > 0;
  } catch (err) {
    console.error(`[discover-seeds] validation failed for ${platform}:${slug}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function detect(website: string): Promise<Awaited<ReturnType<typeof detectAts>>> {
  try {
    return await detectAts(website);
  } catch (err) {
    console.error(`[discover-seeds] detect failed for ${website}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  console.log(`[discover-seeds] starting${limit ? ` (limit ${limit})` : ""}`);

  const summary = await runDiscovery({
    fetchCompanies: fetchYcCompanies,
    detect,
    validate: validateSlug,
    readExisting: (platform) => readSeedFile(platform),
    writeSeeds: (platform, entries) => writeSeedFile(platform, entries),
    now: () => new Date().toISOString(),
    sleep,
    delayMs: randomDelay,
    limit,
  });

  console.log("\n[discover-seeds] summary:");
  console.log(`  companies probed:         ${summary.probed}`);
  console.log(`  ATS matches found:        ${summary.matched}`);
  console.log(`  new seeds validated:      ${summary.validated}`);
  console.log(`  skipped (already known):  ${summary.skippedDuplicate}`);
  console.log(`  validation failed:        ${summary.validationFailed}`);
  console.log(`  no ATS match:             ${summary.noMatch}`);
  for (const [platform, count] of Object.entries(summary.byPlatform)) {
    console.log(`    + ${count} ${platform}`);
  }
}

main().catch((err) => {
  console.error("[discover-seeds] fatal:", err);
  process.exitCode = 1;
});
