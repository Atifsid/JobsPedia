import { aggregatorConfig, aggregatorSearchTerms, atsSeeds } from "./config.js";
import { dedupeAndMerge } from "./dedupe.js";
import { markStale, openDb, upsertJobs } from "./db.js";
import { newJobSchema, type NewJob, type Source } from "./schema.js";
import { atsScrapers } from "./sources/ats/index.js";
import { fetchAggregatorJobs } from "./sources/jobspy.js";

interface SourceResult {
  label: string;
  ok: boolean;
  count: number;
  error?: string;
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
    const scraper = atsScrapers.find((s) => s.platform === seed.platform);
    const label = `${seed.platform}:${seed.slug}`;
    if (!scraper) {
      results.push({ label, ok: false, count: 0, error: "no scraper registered" });
      continue;
    }
    try {
      const valid = validate(await scraper.fetch(seed.slug), label);
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
    const label = `aggregator:${term}`;
    try {
      const raw = await fetchAggregatorJobs({
        site_name: [...aggregatorConfig.site_name],
        search_term: term,
        location: aggregatorConfig.location,
        results_wanted: aggregatorConfig.resultsWanted,
      });
      const valid = validate(raw, label);
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

/**
 * `--only aggregators` is the only way to run the jobspy-js side — it stays off by
 * default (and under `--only ats`) since it's the slower, rate-limit-prone half.
 */
function parseMode(argv: string[]): Source {
  const idx = argv.indexOf("--only");
  const value = idx !== -1 ? argv[idx + 1] : undefined;
  return value === "aggregators" ? "aggregator" : "ats";
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  console.log(`[crawl] starting (source: ${mode})`);

  const { jobs: rawJobs, results } = mode === "aggregator" ? await crawlAggregators() : await crawlAts();
  const merged = dedupeAndMerge(rawJobs);

  const db = openDb();
  try {
    upsertJobs(db, merged);
    markStale(
      db,
      merged.map((j) => j.id),
      mode,
    );
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
