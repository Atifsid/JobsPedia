## What this is

`jobspedia` merges two job-data sources into one local dataset and serves it over a
small local API:

1. **Aggregator boards** (LinkedIn, Indeed, Glassdoor, …) via the `jobspy-js` npm package.
2. **ATS-direct** sources (Greenhouse, Lever, Ashby, SmartRecruiters, …) via thin
   hand-written fetchers that hit each ATS platform's public JSON API.

Both are normalized into one schema, deduplicated, written to a local SQLite file,
and exposed via `POST /jobs/search`. The primary consumer is **JobFlowAI**, which
talks to this service as a `JobProvider` over `localhost` (drop-in replacement for
its old HireBase provider). A future public search UI would consume the same API.

The code is open source. The running instance is **local / single-user today**.
Prefer simple and good-enough over scalable. Don't add infrastructure until a real
problem forces it.

## Architecture — crawl and serve are decoupled

```
[cron] -> crawl.ts -> (jobspy-js + ATS fetchers) -> normalize -> dedupe -> jobs.db
                                                                              |
                                          serve (Hono :8080) reads <----------+
                                                    |
                                          JobFlowAI / future UI (HTTP clients)
```

- **Crawl** (`crawl.ts`) runs on a schedule, populates `jobs.db`, marks vanished
  jobs inactive. It is the ONLY thing that touches the network.
- **Serve** (`server.ts`) only reads `jobs.db`. A slow or failed crawl must never
  affect live queries.

Never scrape inside a request handler. Live per-request scraping gets the IP
rate-limited (LinkedIn especially, ~page 10). All scraping happens in the crawl.

## Tech stack

- Node 20+, TypeScript (ESM), `tsx` to run scripts
- `jobspy-js` — aggregator scraping. Do NOT reimplement this half.
- `better-sqlite3` — storage. Synchronous, single-file, WAL mode.
- `hono` + `@hono/node-server` — the local read API
- `zod` — validate scraped data before it enters the DB
- `vitest` — tests

## Repo layout

```
src/
  schema.ts          # Zod Job schema + inferred types (single source of truth)
  sources/
    jobspy.ts        # adapter: jobspy-js output -> Job[]
    common/           # shared, source-agnostic helpers (http retry, html/location/
                      # salary/date parsing, pagination, per-record error isolation,
                      # bounded concurrency) — used by every ATS provider
    ats/
      base.ts        # AtsScraper interface only
      greenhouse.ts  # one file per ATS platform
      lever.ts
      ashby.ts
      smartrecruiters.ts
      workable.ts
      recruitee.ts
      comeet.ts
      breezyhr.ts
      jobscore.ts
      personio.ts
      bamboohr.ts
      teamtailor.ts             # public JSON Feed (jsonfeed.org spec)
      pinpoint.ts               # public JSON, {data: [...]} wrapper (postings.json)
      rippling.ts               # public JSON, official documented Job Board API
      oracle_recruiting_cloud.ts # public JSON; compound "{host}:{siteNumber}" slug
      sap_successfactors.ts      # public XML/RSS full-board feed (sitemal.xml)
      eightfold.ts                # public JSON for "SmartApply" tenants only;
                                   # compound "{tenant}:{domain}" slug
      jobvite.ts                   # HTML scraping via cheerio (no JSON feed exists)
      index.ts       # registry: exported list of all ATS scrapers
    apis/
      base.ts        # ApiProvider interface (no-seed, direct-fetch APIs)
      remoteok.ts
      remotive.ts
      themuse.ts        # scoped to museConfig.categories, bounded pages/category
      remotejobsorg.ts   # scoped to remoteJobsOrgCategories, fully paginated (small board)
      himalayas.ts         # scoped to himalayasConfig.searchTerms, bounded pages/term
      adzuna.ts              # scoped to adzunaConfig.searchTerms x countries; needs
                             # ADZUNA_APP_ID/ADZUNA_APP_KEY env vars (see README Setup)
      index.ts       # registry: exported list of all API providers
  discovery/
    ycombinator.ts    # YC Algolia company-directory fetch (paginated, isHiring:true)
    detectAts.ts       # career-page probing -> ATS platform/slug detection
    pipeline.ts          # discovery orchestration, dependency-injected for tests
  seeds/
    store.ts            # seed JSON file schema + read/write/list
    <platform>.json      # one file per ATS platform, committed to git (source: "manual" | "yc-discovery")
  scope.ts                # --scope flag parsing + seed filtering for crawl.ts
  dedupe.ts          # dedupeAndMerge(jobs): Job[]
  db.ts              # SQLite init/migrations, upsert, markStale
  crawl.ts           # orchestrator — run sources, normalize, dedupe, upsert (cron entry)
  search.ts          # searchJobs() — the FTS5 query the server runs
  server.ts          # Hono API: POST /jobs/search
  config.ts          # what to crawl: search terms + ATS company slugs
data/
  jobs.db            # gitignored
scripts/
  discover-seeds.ts # npm run discover-seeds — grows src/seeds/*.json from YC's directory
```

## Commands

```
npm run crawl                 # full crawl -> jobs.db
npm run crawl -- --only ats   # crawl only ATS sources
npm run crawl -- --only aggregators
npm run crawl -- --scope <name>  # filter ATS seeds by YC industry/tag
npm run discover-seeds           # grow src/seeds/*.json from YC's company directory
npm run serve                 # start the read API on :8080
npm run typecheck             # tsc --noEmit
npm test
```

## The /jobs/search contract (stable — JobFlowAI depends on it)

Request body:

```jsonc
{
  "title":     "software engineer",  // string, optional — matches jobs.title only
  "keywords":  ["python", "aws"],    // string[], optional — matches title+company+description
  "company":   "Stripe",             // optional — substring match
  "remote":    true,                 // boolean, optional
  "visaSponsorship": true,           // boolean, optional — true/false excludes unknown (null); omit for no filter
  "city":      "Berlin",             // optional
  "region":    "BE",                 // optional
  "country":   "DE",                 // optional
  "seniority": ["senior", "staff"],  // string[], optional — exact match against jobs.seniority;
                                      // one of internship/entry/mid/senior/lead/staff/principal
  "minSalary": 100000,               // optional — never excludes jobs with undisclosed salary
  "maxSalary": 180000,               // optional — never excludes jobs with undisclosed salary
  "daysAgo":   30,                   // optional — freshness filter on date_posted
  "source":    "ats",                // "ats" | "aggregator" — omit for both
  "page":      1,                    // default 1
  "limit":     20                    // default 20, capped at 100
}
```

Response:

```jsonc
{ "jobs": [ /* Job rows */ ], "page": 1, "count": 20, "total": 137 }
```

Do not rename these fields casually — changing them breaks JobFlowAI's
`JobspediaService`. If a field must change, update the consumer's mapper too.

## Database schema

`search.ts` and `db.ts` assume:

```sql
CREATE TABLE jobs (
  id           TEXT PRIMARY KEY,   -- stable hash of the canonical apply URL
  title        TEXT NOT NULL,
  company      TEXT NOT NULL,
  location     TEXT,
  city         TEXT, region TEXT, country TEXT,
  seniority    TEXT,               -- derived from title at crawl time: internship/entry/mid/
                                    -- senior/lead/staff/principal
  is_remote    INTEGER DEFAULT 0,
  visa_sponsorship INTEGER,         -- 1 = confirmed H-1B sponsor (USCIS match), NULL = unknown
                                    -- (0/false supported by column/filter but not set by any provider)
  salary_min   INTEGER, salary_max INTEGER, currency TEXT,
  apply_url    TEXT NOT NULL,
  description  TEXT,
  date_posted  TEXT,               -- ISO 8601
  platform     TEXT,               -- "greenhouse" | "lever" | "linkedin" | ...
  source       TEXT,               -- "ats" | "aggregator"
  first_seen   TEXT, last_seen TEXT,
  is_active    INTEGER DEFAULT 1
);

CREATE VIRTUAL TABLE jobs_fts USING fts5(
  title, company, description,
  content='jobs', content_rowid='rowid'
);
```

- WAL mode is required (`PRAGMA journal_mode = WAL`) so the crawler can write while
  the server reads — no "database is locked".
- Keep the FTS index in sync with `jobs` via triggers (INSERT/UPDATE/DELETE).
- `id` = hash of the canonical apply URL. This is the dedup key (see below).
- Lifecycle: on each crawl, upsert seen jobs (bump `last_seen`), then set
  `is_active = 0` for anything not seen this run. Never hard-delete.

## Adding an ATS scraper (the most common task)

Most ATS platforms expose public JSON, so a scraper is small.

1. Create `src/sources/ats/<platform>.ts` implementing `AtsScraper` from `base.ts`:
   ```ts
   export const greenhouse: AtsScraper = {
     platform: "greenhouse",
     async fetch(slug: string): Promise<Job[]> {
       const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
       const { jobs } = await res.json();
       return jobs.map(toJob); // map into the canonical schema, source: "ats"
     },
   };
   ```
2. Register it in `src/sources/ats/index.ts`.
3. Add the company slugs to crawl in `config.ts`.
4. Add a test with a recorded fixture (never hit the network in tests).

Shared helpers live in `src/sources/common/` — reach for `fetchJson`/`fetchText`
(retry-on-transient-failure built in), `parseLocation`, `stripHtml`, `sanitizeSalary`,
`humanizeSlug`, `toIsoDate`, `paginate` (offset/limit pagination), `mapSkipInvalid`
(drop one bad record without failing the whole fetch), and `mapWithConcurrency`
(bounded-parallelism per-record detail fetches) before writing anything new — don't
duplicate what's already there.

Use the Python `jobhive` scrapers (`stapply-ai/ats-scrapers`) as the spec for each
platform's endpoint and field mapping — each is a ~50-line `fetch()`. Port the logic,
don't invent it.

**Skip browser-required sources** (e.g. Meta, Tesla — they need a headless browser in
the Python version). Not worth it. Only add one if a must-have company forces it.

## Adding an API provider

Unlike ATS scrapers (which fetch per-company via a slug), API providers return their
entire board in one call — no per-company scoping. RemoteOK and Remotive are two
current examples. The interface is simpler:

1. Create `src/sources/apis/<platform>.ts` implementing `ApiProvider` from `base.ts`:
   ```ts
   export const remoteok: ApiProvider = {
     platform: "remoteok",
     async fetch(): Promise<Job[]> {
       const res = await fetch("https://remoteok.com/api");
       const jobs = await res.json();
       return jobs.map(toJob); // map into the canonical schema, source: "aggregator"
     },
   };
   ```
2. Register it in `src/sources/apis/index.ts`.
3. Add a test with a recorded fixture (never hit the network in tests).

Reach for the same helpers in `src/sources/common/` as ATS scrapers do.

## Aggregators via jobspy-js

`src/sources/jobspy.ts` calls `jobspy-js`'s `scrapeJobs()` and maps the result into
the canonical `Job` schema with `source: "aggregator"`. Do not reimplement scraping —
jobspy-js already handles LinkedIn/Indeed/Glassdoor/etc., TLS fingerprinting, proxy
rotation, and rate-limit backoff. Keep `resultsWanted` modest to avoid LinkedIn 429s.

## Dedup rules

The same job often appears both ATS-direct AND reposted on aggregators.
`dedupeAndMerge` must collapse these:

1. **Primary key**: canonical apply URL. Aggregator postings often link back to the
   real Greenhouse/Lever/Ashby URL — extract it and match on that.
2. **Fallback**: fuzzy match on `normalize(company) + normalize(title) + location`.
3. **Tie-break: the ATS-direct record wins.** It has cleaner fields and structured
   salary. Fill gaps (e.g. a salary the ATS didn't expose) from the aggregator record.

Never just concatenate the two sources — that rebuilds the duplicate-ridden feed this
project exists to eliminate.

## Conventions

- ESM, `async/await`. Network access confined to `sources/` and `crawl.ts`.
  `db.ts`, `dedupe.ts`, `search.ts` are offline and easy to test.
- All scraped data crosses a Zod parse before entering the DB.
- Fail soft in the crawl: one broken scraper logs and is skipped, never aborts the run.
  Print a per-source summary at the end.
- Small, copy-pasteable scraper files beat a clever abstraction. When in doubt, duplicate.
- Round/validate salary values; drop obviously bad rows rather than storing garbage.

## Git conventions

- Write plain, concise commit messages describing the change.
- Do NOT add a `Co-Authored-By: Claude` trailer to any commit.
- Do NOT add a "Generated with Claude Code" / "🤖" footer or any tool-attribution
  line to commit messages or PR descriptions.
- No attribution to Claude, Anthropic, or any AI tool anywhere in git history.

## Constraints & non-goals

- **Single-user, local-first.** No auth, no rate-limiting middleware, no queue/worker
  system. The server binds localhost.
- **Don't over-engineer.** No proxies or Browserbase unless a real gap forces it.
  Daily-ish freshness is fine.
- **Aggregators are fine for local/personal use.** But if the future public UI ships,
  serving scraped LinkedIn/Indeed/Glassdoor data publicly is a real legal exposure —
  at that point make ATS-direct the public dataset and keep aggregators private / for
  JobFlowAI only. Not legal advice; get counsel before a public launch.

## Gotchas

- LinkedIn rate-limits hard; keep aggregator `resultsWanted` modest.
- Indeed searches descriptions too, so results can look loosely related — expected.
- Wrap crawl upserts in a single `better-sqlite3` transaction for speed.
- Keep `jobs_fts` triggers in place, or full-text search silently goes stale.
- `data/jobs.db` is gitignored — never commit the dataset.