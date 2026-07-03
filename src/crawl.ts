import { aggregatorConfig, aggregatorSearchTerms, atsSeeds } from "./config.js";
import { dedupeAndMerge } from "./dedupe.js";
import { markStale, openDb, upsertJobs } from "./db.js";
import { newJobSchema, type NewJob } from "./schema.js";
import { atsScrapers } from "./sources/ats/index.js";
import { fetchAggregatorJobs } from "./sources/jobspy.js";

interface SourceResult {
  label: string;
  ok: boolean;
  count: number;
  error?: string;
}

const AGGREGATOR_DELAY_MIN = 5000;
const AGGREGATOR_DELAY_MAX = 10000;
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): number {
  return Math.floor(Math.random() * (AGGREGATOR_DELAY_MAX - AGGREGATOR_DELAY_MIN + 1)) + AGGREGATOR_DELAY_MIN;
}

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt < MAX_RETRIES) {
        await sleep(attempt * 10000);
      }
    }
  }

  throw lastError;
}

function validate(raw: NewJob[], label: string): NewJob[] {
  const valid: NewJob[] = [];
  for (const job of raw) {
    const parsed = newJobSchema.safeParse(job);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      console.error(`[crawl] ${label}: dropped invalid job — ${parsed.error.issues[0]?.message}`);
    }
  }
  return valid;
}

async function crawlAts(): Promise<{ jobs: NewJob[]; results: SourceResult[] }> {
  const jobs: NewJob[] = [];
  const results: SourceResult[] = [];
  for (const seed of atsSeeds) {
    console.log(`[crawl] ATS ${seed.platform}:${seed.slug}`);
    const scraper = atsScrapers.find((s) => s.platform === seed.platform);
    const label = `${seed.platform}:${seed.slug}`;
    if (!scraper) {
      results.push({ label, ok: false, count: 0, error: "no scraper registered" });
      continue;
    }
    try {
      const valid = validate(await scraper.fetch(seed.slug), label);
      console.log(`[crawl] ATS ${seed.platform}:${seed.slug} -> ${valid.length} jobs`);
      jobs.push(...valid);
      results.push({ label, ok: true, count: valid.length });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ label, ok: false, count: 0, error });
      console.error(`[crawl] ${label} failed: ${error}`);
    }
  }
  return { jobs, results };
}

async function crawlAggregators(): Promise<{ jobs: NewJob[]; results: SourceResult[] }> {
  const jobs: NewJob[] = [];
  const results: SourceResult[] = [];
  for (const term of aggregatorSearchTerms) {
    console.log(`[crawl] Aggregator "${term}"`);
    const label = `aggregator:${term}`;
    try {
      const raw = await retry(() =>
        fetchAggregatorJobs({
          site_name: [...aggregatorConfig.site_name],
          search_term: term,
          location: aggregatorConfig.location,
          results_wanted: aggregatorConfig.resultsWanted,
        }),
      );
      const valid = validate(raw, label);
      console.log(`[crawl] Aggregator "${term}" -> ${valid.length} jobs`);
      jobs.push(...valid);
      results.push({ label, ok: true, count: valid.length });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ label, ok: false, count: 0, error });
      console.error(`[crawl] ${label} failed: ${error}`);
    }
    const delay = randomDelay();
    console.log(`[crawl] Waiting ${Math.round(delay / 1000)}s`);
    await sleep(delay);
  }
  return { jobs, results };
}

/**
 * `--only aggregators` is the only way to run the jobspy-js side — it stays off by
 * default (and under `--only ats`) since it's the slower, rate-limit-prone half.
 */
type CrawlMode = "ats" | "aggregator" | "all";

function parseMode(argv: string[]): CrawlMode {
  const idx = argv.indexOf("--only");
  const value = idx !== -1 ? argv[idx + 1] : undefined;

  if (value === "aggregators") return "aggregator";
  if (value === "all") return "all";
  return "ats";
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  console.log(`[crawl] starting (source: ${mode})`);

  let rawJobs: NewJob[] = [];
  let results: SourceResult[] = [];

  if (mode === "ats") {
    ({ jobs: rawJobs, results } = await crawlAts());
  } else if (mode === "aggregator") {
    ({ jobs: rawJobs, results } = await crawlAggregators());
  } else {
    const [aggregators, ats] = await Promise.all([
      crawlAggregators(),
      crawlAts(),
    ]);

    rawJobs = [...ats.jobs, ...aggregators.jobs];
    results = [...ats.results, ...aggregators.results];
  }
  const merged = dedupeAndMerge(rawJobs);

  const db = openDb();
  try {
    upsertJobs(db, merged);
    if (mode === "ats" || mode === "all") {
      markStale(
        db,
        rawJobs.filter((j) => j.source === "ats").map((j) => j.id),
        "ats",
      );
    }

    if (mode === "aggregator" || mode === "all") {
      markStale(
        db,
        rawJobs.filter((j) => j.source === "aggregator").map((j) => j.id),
        "aggregator",
      );
    }
  } finally {
    db.close();
  }

  console.log("\n[crawl] summary:");
  for (const r of results) {
    console.log(`  ${r.ok ? "OK  " : "FAIL"} ${r.label} — ${r.ok ? `${r.count} jobs` : r.error}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`  ${rawJobs.length} raw -> ${merged.length} after dedupe (${failed}/${results.length} sources failed)`);
}

main().catch((err) => {
  console.error("[crawl] fatal:", err);
  process.exitCode = 1;
});
